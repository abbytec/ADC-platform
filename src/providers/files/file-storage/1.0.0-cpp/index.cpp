#include <iostream>
#include <filesystem>
#include "../../../../interfaces/interop/cpp/base_module.hpp"

namespace fs = std::filesystem;

class FileStorage : public Adc::Core::BaseProvider
{
public:
    FileStorage()
    {
        // Obtener storage_path de la configuración
        auto config = getConfig();
        if (config.contains("storagePath"))
        {
            _storage_path = config["storagePath"].get<std::string>();
        }
        else
        {
            _storage_path = "./storage";
        }

        // Crear directorio de almacenamiento
        try
        {
            fs::create_directories(_storage_path);
            logInfo("Storage directory created: " + _storage_path);
        }
        catch (const std::filesystem::filesystem_error &e)
        {
            logError("Failed to create storage directory: " + std::string(e.what()));
        }

        // Registrar métodos expuestos al IPC
        registerMethod("getStoragePath", [this](const std::vector<nlohmann::json> &) -> nlohmann::json
                       { return {{"path", _storage_path}}; });
    }

    ~FileStorage()
    {
        logInfo("FileStorage destroyed.");
    }

private:
    std::string _storage_path;
};

// Punto de entrada del módulo
int main()
{
    try
    {
        FileStorage module;
        module.run(); // Bloquea y atiende peticiones IPC
    }
    catch (const std::exception &e)
    {
        std::cerr << "[FATAL] " << e.what() << std::endl;
        return 1;
    }
    return 0;
}