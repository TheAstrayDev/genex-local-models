// Local audio.cpp compatibility patch. No permission grants or sandbox changes.
// Windows can open a granted model while refusing normalized ancestor queries.
#pragma once
#include <filesystem>
#include <system_error>
#ifdef _WIN32
#ifndef NOMINMAX
#define NOMINMAX
#endif
#include <windows.h>
#include <vector>
#endif
namespace genex_lpac {
inline std::filesystem::path weakly_canonical(const std::filesystem::path& path, std::error_code& ec) {
    auto result = std::filesystem::weakly_canonical(path, ec);
#ifdef _WIN32
    if (ec == std::errc::permission_denied || ec.value() == ERROR_ACCESS_DENIED) {
        // FILE_NAME_OPENED queries this already-open handle rather than requiring
        // read-attributes access to every ancestor. The kernel still enforces LPAC.
        HANDLE file = CreateFileW(path.c_str(), 0, FILE_SHARE_READ | FILE_SHARE_WRITE | FILE_SHARE_DELETE,
                                  nullptr, OPEN_EXISTING, FILE_FLAG_BACKUP_SEMANTICS, nullptr);
        if (file != INVALID_HANDLE_VALUE) {
            std::vector<wchar_t> buffer(32768);
            DWORD size = GetFinalPathNameByHandleW(file, buffer.data(), static_cast<DWORD>(buffer.size()), FILE_NAME_OPENED);
            CloseHandle(file);
            if (size && size < buffer.size()) {
                ec.clear();
                return std::filesystem::path(std::wstring(buffer.data(), size));
            }
            // Some LPAC configurations also refuse the volume-name query. These
            // plugin paths are fixed, verified, and contain no reparse points.
            // Preserve the name of the file we successfully opened. This does
            // not grant access: every subsequent open is still checked by LPAC.
            auto opened = std::filesystem::absolute(path, ec);
            if (!ec) return opened.lexically_normal();
        }
    }
#endif
    return result;
}
inline std::filesystem::path weakly_canonical(const std::filesystem::path& path) {
    std::error_code ec;
    auto result = genex_lpac::weakly_canonical(path, ec);
    if (ec) throw std::filesystem::filesystem_error("weakly_canonical", path, ec);
    return result;
}
}
