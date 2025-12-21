#include <iostream>
#include <filesystem>

#include "../../../../interfaces/interop/cpp/kernel_logger.hpp"

namespace fs = std::filesystem;
class FileStorage
{
public:
    FileStorage(const std::string &storage_path, Core::KernelLogger logger)
        : _storage_path(storage_path), _logger(std::move(logger))
    {
        try
        {
            fs::create_directories(_storage_path);
        }
        catch (const std::filesystem::filesystem_error &e)
        {
            _logger.error(std::string("Failed to create storage directory: ") + e.what());
        }
    }

    ~FileStorage()
    {
        std::cout << "FileStorage destroyed." << std::endl;
    }

private:
    std::string _storage_path;
    Core::KernelLogger _logger;
};