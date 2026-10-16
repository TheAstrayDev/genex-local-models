"""One sandboxed job using pinned local adapters. No server or downloads."""
import base64
import json
import os
import subprocess
import sys
import time
import struct
import zlib
from pathlib import Path


class TransparencyError(ValueError):
    pass


def image_purpose(request):
    purpose = request.get("purpose", "asset")
    if purpose not in {"asset", "icon", "model-reference", "scene", "texture"}:
        raise ValueError("Unsupported image purpose")
    return purpose


def image_prompt(request):
    """Qwen's documented native-RGBA format surrounds the agent's own description.

    Source: https://github.com/QwenLM/Qwen-Image-2.1#transparent-image-generation-rgba
    No separate chat model or image editor is used.
    """
    purpose = image_purpose(request)
    if purpose in {"scene", "texture"}:
        return request["prompt"]
    composition = {
        "asset": "One isolated game asset, complete silhouette, centered with a small clear margin.",
        "icon": "One game icon, clear readable silhouette, complete object, centered with a small clear margin.",
        "model-reference": "One physical object for 3D reconstruction, three-quarter front view, entire object visible, filling most of the frame with a clear margin, soft diffuse lighting. Clear structural detail, well-separated components, readable surface materials and accurate proportions. Smooth continuous curved surfaces unless the requested style is explicitly faceted. Avoid motion blur, extreme perspective, depth-of-field blur and baked highlights.",
    }[purpose]
    return ("This is an RGBA image with transparency. " + request["prompt"].strip() + ". " + composition +
            " No scenery, solid backdrop, floor, pedestal, cast shadow, checkerboard pattern or extra objects. "
            "Preserve the requested object, materials and art style. "
            "The image has alpha channel and the background is transparent.")


def require_transparent_png(file, size):
    """Read alpha without modifying any pixels. Uses only the compact runtime's stdlib."""
    with Path(file).open("rb") as source:
        data = source.read(16 * 1024**2 + 1)
    if len(data) > 16 * 1024**2 or not data.startswith(b"\x89PNG\r\n\x1a\n"):
        raise TransparencyError("Expected a bounded RGBA PNG")
    offset, compressed, header, ended = 8, [], None, False
    while offset + 12 <= len(data):
        length = struct.unpack_from(">I", data, offset)[0]
        if offset + length + 12 > len(data):
            raise TransparencyError("Truncated PNG")
        kind = data[offset+4:offset+8]
        chunk = data[offset+8:offset+8+length]
        if zlib.crc32(kind + chunk) & 0xffffffff != struct.unpack_from(">I", data, offset+8+length)[0]:
            raise TransparencyError("Invalid PNG checksum")
        if kind == b"IHDR":
            header = struct.unpack(">IIBBBBB", chunk)
        elif kind == b"IDAT":
            compressed.append(chunk)
        offset += length + 12
        if kind == b"IEND":
            ended = length == 0
            break
    if not ended or header != (size, size, 8, 6, 0, 0, 0):
        raise TransparencyError("Native transparent output must be an 8-bit RGBA PNG at the requested size")
    stride, expected = size * 4, size * (size * 4 + 1)
    decoder = zlib.decompressobj()
    raw = decoder.decompress(b"".join(compressed), expected + 1)
    if len(raw) != expected or not decoder.eof or decoder.unused_data:
        raise TransparencyError("Invalid PNG pixel stream")
    previous, histogram = bytearray(stride), [0] * 256
    for y in range(size):
        begin = y * (stride + 1)
        filtering, row = raw[begin], bytearray(raw[begin+1:begin+stride+1])
        if filtering not in range(5):
            raise TransparencyError("Unsupported PNG filter")
        if filtering:
            for x in range(stride):
                left, up = row[x-4] if x >= 4 else 0, previous[x]
                corner = previous[x-4] if x >= 4 else 0
                if filtering == 1:
                    predictor = left
                elif filtering == 2:
                    predictor = up
                elif filtering == 3:
                    predictor = (left + up) // 2
                else:
                    p = left + up - corner
                    a, b, c = abs(p-left), abs(p-up), abs(p-corner)
                    predictor = left if a <= b and a <= c else up if b <= c else corner
                row[x] = (row[x] + predictor) & 255
        for alpha in row[3::4]:
            histogram[alpha] += 1
        previous = row
    pixels = size * size
    transparent, foreground = sum(histogram[:17]), sum(histogram[128:])
    if transparent < pixels * 0.01 or foreground < pixels * 0.01:
        raise TransparencyError("Qwen did not generate real transparent background and visible foreground; no cutout was accepted")
    return {"verified": True, "transparentFraction": round(transparent/pixels, 4),
            "foregroundFraction": round(foreground/pixels, 4), "zeroAlphaFraction": round(histogram[0]/pixels, 4)}


def request_value(encoded):
    if len(encoded) > 12000:
        raise ValueError("Request too large")
    value = json.loads(base64.b64decode(encoded, validate=True))
    if not isinstance(value, dict):
        raise ValueError("Expected request object")
    if not isinstance(value.get("seed"), int) or not 0 <= value["seed"] <= 2147483647:
        raise ValueError("Invalid seed")
    if "prompt" in value and (not isinstance(value["prompt"], str) or not 1 <= len(value["prompt"].strip()) <= 2000 or "\0" in value["prompt"]):
        raise ValueError("Invalid prompt")
    return value


def image_command(root, request, output):
    if request.get("model") != "qwen-image-2.1-turbo" or set(request) not in ({"model", "prompt", "seed", "size"}, {"model", "prompt", "seed", "size", "purpose"}):
        raise ValueError("Unsupported image profile")
    if request["size"] not in (512, 768):
        raise ValueError("Unsupported image size")
    config = json.loads((root / "runtime.json").read_text(encoding="utf8"))
    binary = (root / config["sd_cli"]).resolve()
    backend = config.get("backend", "cuda")
    if backend not in {"cuda", "vulkan", "metal"}:
        raise ValueError("Unsupported image backend")
    if not binary.is_relative_to(root.resolve()) or binary.name != ("sd-cli" if backend == "metal" else "sd-cli.exe"):
        raise ValueError("Invalid reviewed runtime")
    models = root / "models" / request["model"]
    return [str(binary), "--diffusion-model", str(models / "diffusion.gguf"),
            "--llm", str(models / "text-encoder.gguf"), "--vae", str(models / "vae.safetensors"),
            "-p", image_prompt(request), "-o", str(output), "-W", str(request["size"]), "-H", str(request["size"]),
            "--seed", str(request["seed"]), "--steps", "8", "--cfg-scale", "1.0", "--sigmas", "qwen-image-2.1-turbo",
            "--sampling-method", "euler", "--diffusion-fa", "--vae-tiling", "--mmap",
            "--params-backend", "disk", "--threads", "6"]


def runtime_root(executable):
    binary = Path(executable).resolve()
    if binary.parent.name == "bin" and binary.parent.parent.name == "Contents" and binary.parent.parent.parent.suffix == ".app":
        return binary.parent.parent
    return binary.parent


def audio_command(root, request, output):
    config = root / "audio-backend.json"
    backend = json.loads(config.read_text(encoding="utf8"))["backend"] if config.exists() else "cuda"
    if backend not in {"cuda", "vulkan", "metal"}:
        raise ValueError("Unsupported audio backend")
    if request.get("model") not in ("stable-audio-3-small-music", "stable-audio-3-small-sfx"):
        raise ValueError("Unsupported audio model")
    if set(request) != {"model", "prompt", "seed", "duration"} or not isinstance(request["duration"], (int, float)) or not 1 <= request["duration"] <= 120:
        raise ValueError("Invalid audio request")
    model_file = root / "models" / request["model"] / "model.gguf"
    with model_file.open("rb") as source:
        if source.read(4) != b"GGUF":
            raise ValueError("Audio model is not a GGUF file")
    return [str(root / "bin" / ("audiocpp_cli" if backend == "metal" else "audiocpp_cli.exe")), "--task", "gen", "--family", "stable_audio",
            "--model", str(Path("models") / request["model"] / "model.gguf"), "--backend", backend,
            "--text", request["prompt"], "--duration-seconds", str(request["duration"]),
            "--num-inference-steps", "8", "--seed", str(request["seed"]),
            "--session-option", "stable_audio.mem_saver=true", "--out", str(output)]


def cleanup_model_auxiliary(output):
    # The GLB embeds its textures. Do not retain the CLI's large debug PLY or PNG.
    for auxiliary in [output.with_suffix(".ply"), output.with_name(output.stem + "_base.png")]:
        if auxiliary.is_file() and not auxiliary.is_symlink():
            auxiliary.unlink()


def run(kind, output, encoded, input_image=None):
    request = request_value(encoded)
    root = runtime_root(sys.executable)
    output = Path(output).resolve()
    started = time.monotonic()
    # Never let inference reach accounts or start downloads. All weights must be staged.
    env = {**os.environ, "HF_HUB_OFFLINE": "1", "TRANSFORMERS_OFFLINE": "1",
           "HF_HOME": str(root / "hf-cache"), "PYTHONDONTWRITEBYTECODE": "1",
           "PYTHONIOENCODING": "utf-8:replace", "PYTHONUTF8": "1"}
    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    if os.name == "nt":
        # NVIDIA's Windows startup can stall before main() when its cache path exceeds
        # MAX_PATH. Shorten only the host-granted scratch path; never escape the sandbox.
        import ctypes
        scratch = Path(env.get("TMPDIR", env.get("TEMP", str(output.parent))))
        buffer = ctypes.create_unicode_buffer(32768)
        length = ctypes.windll.kernel32.GetShortPathNameW(str(scratch), buffer, len(buffer))
        short = Path(buffer.value) if 0 < length < len(buffer) else scratch
        if len(str(short)) > 150:
            raise RuntimeError("The sandbox cache path is too long for the Windows GPU driver. Use a shorter Genex profile path; no model was loaded.")
        for key, folder in {"TEMP": "", "TMP": "", "TMPDIR": "", "APPDATA": "Roaming", "LOCALAPPDATA": "Local", "CUDA_CACHE_PATH": "CudaCache"}.items():
            directory = short / folder
            directory.mkdir(parents=True, exist_ok=True)
            env[key] = str(directory)
    if kind == "image":
        command = image_command(root, request, output)
    elif kind == "audio":
        # The small custom CLI uses upstream's host Philox implementation; GPU
        # inference remains in the released GGML CUDA backend. Pin deterministic
        # noise rather than requesting the optional nvcc-only RNG helper.
        env["ENGINE_TORCH_SAMPLING_POLICY"] = "default"
        command = audio_command(root, request, output)
    elif kind == "model":
        from hunyuan import command as hunyuan_command
        command = hunyuan_command(root, request, output, input_image)
    else:
        raise ValueError("Unknown generation kind")
    # Retain diagnostic output even if the outer plugin wait ends before its native job.
    # Scratch belongs to this sandbox job and is never delivered as a game asset.
    scratch = Path(os.environ.get("TMPDIR", os.environ.get("TEMP", str(output.parent))))
    cutout = kind == "image" and image_purpose(request) not in {"scene", "texture"}
    requested_seed, transparency = request["seed"], None
    # A concrete alpha failure gets one bounded native retry. Each CLI exits before
    # the next starts. No editor, segmentation model or additional service is run.
    for attempt in range(2 if cutout else 1):
        if kind == "image":
            command = image_command(root, request, output)
        log_file = scratch / ("generation.log" if attempt == 0 else "generation-retry.log")
        with log_file.open("wb", buffering=0) as log:
            result = subprocess.run(command, cwd=root, env=env, shell=False, stdout=log, stderr=subprocess.STDOUT)
        with log_file.open("rb") as log:
            log.seek(max(0, log_file.stat().st_size - 60000))
            print(log.read().decode("utf8", errors="replace"), flush=True)
        if result.returncode:
            raise RuntimeError(f"{kind} worker exited with code {result.returncode}")
        if not cutout:
            break
        try:
            transparency = require_transparent_png(output, request["size"])
            break
        except TransparencyError as error:
            if attempt:
                raise RuntimeError(f"NATIVE_RGBA_REQUIRED: {error}. Native transparency failed twice; no opaque substitute was delivered.") from error
            output.replace(scratch / "rejected-opaque-image.png")
            request["seed"] = (requested_seed + 1) % 2147483648
            print(f"Native alpha check failed: {error}. Retrying Qwen once with seed {request['seed']}.", flush=True)
    if not output.is_file() or output.stat().st_size == 0:
        raise RuntimeError("Worker returned without an asset")
    with output.open("rb") as asset:
        header = asset.read(12)
    expected = {"image": b"\x89PNG\r\n\x1a\n", "audio": b"RIFF", "model": b"glTF"}[kind]
    if not header.startswith(expected):
        raise RuntimeError("Worker output has an unexpected file format")
    if kind == "model":
        cleanup_model_auxiliary(output)
    receipt = {"model": request["model"], "seed": request["seed"], "seconds": round(time.monotonic() - started, 3),
               "file": output.name, "bytes": output.stat().st_size,
               "lifecycle": "child process exited; this worker exits next"}
    if kind == "image":
        receipt.update({"purpose": image_purpose(request), "requestedSeed": requested_seed, "attempts": attempt + 1,
                        "promptPolicy": "qwen-native-rgba-v1" if cutout else "full-image-v1", "alpha": transparency})
    elif kind == "model":
        from hunyuan import quality_profile
        quality = request.get("quality", "high")
        receipt.update({"quality": quality, "profile": quality_profile(quality)})
    print("GENEX_LOCAL_RESULT " + json.dumps(receipt), flush=True)


if __name__ == "__main__":
    if len(sys.argv) not in (15, 16):
        raise SystemExit("Expected kind, output, twelve request chunks and optional image")
    encoded = "".join(chunk for chunk in sys.argv[3:15] if chunk != ".")
    run(sys.argv[1], sys.argv[2], encoded, sys.argv[15] if len(sys.argv) == 16 else None)
