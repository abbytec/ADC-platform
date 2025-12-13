#include <iostream>
#include <string>
#include <string_view>
#include <mutex>
#include <cstdlib> // Para std::getenv
#include <optional>
#include <format>
#include <unordered_map>
#include <algorithm>

// Espacio de nombres para mantener la higiene
namespace Core
{

    enum class LogLevel
    {
        DEBUG,
        INFO,
        OK, // El nivel raro que tenía tu script de Python
        WARN,
        ERROR
    };

    class KernelLogger
    {
    public:
        // Constructor explícito
        explicit KernelLogger(std::string_view module_name)
            : _module_name(module_name)
        {

            // Leemos la variable de entorno de forma segura
            const char *env_level = std::getenv("ADC_LOG_LEVEL");
            _min_level = parseLevel(env_level ? env_level : "info");
        }

        // --- Métodos de Logging ---
        // Usamos plantillas variádicas o string_view para eficiencia.
        // Aquí simplificamos recibiendo el mensaje directo.

        void debug(std::string_view message)
        {
            log(LogLevel::DEBUG, message);
        }

        void info(std::string_view message)
        {
            log(LogLevel::INFO, message);
        }

        void ok(std::string_view message)
        {
            log(LogLevel::OK, message);
        }

        void warn(std::string_view message)
        {
            log(LogLevel::WARN, message);
        }

        // Alias que pedía el script
        void warning(std::string_view message)
        {
            warn(message);
        }

        void error(std::string_view message)
        {
            log(LogLevel::ERROR, message);
        }

    private:
        std::string _module_name;
        LogLevel _min_level;

        // Mutex estático: Protege stderr a través de TODAS las instancias del logger.
        // Esencial para IPC concurrente.
        static inline std::mutex _io_mutex;

        // Conversión a String (Compile-time capable logic)
        static constexpr std::string_view levelToString(LogLevel level)
        {
            switch (level)
            {
            case LogLevel::DEBUG:
                return "DEBUG";
            case LogLevel::INFO:
                return "INFO";
            case LogLevel::OK:
                return "OK";
            case LogLevel::WARN:
                return "WARN"; // Python dice "warn" -> "WARN"
            case LogLevel::ERROR:
                return "ERROR";
            default:
                return "UNKNOWN";
            }
        }

        // Parseo de configuración (Case insensitive manual para no depender de libs externas pesadas)
        static LogLevel parseLevel(std::string_view input)
        {
            // Un hash simple o comparaciones directas son más rápidas que un mapa para tan pocos elementos
            // Pero para robustez con strings sucios de ENV, hacemos esto:
            std::string s(input);
            std::transform(s.begin(), s.end(), s.begin(),
                           [](unsigned char c)
                           { return std::tolower(c); });

            if (s == "debug")
                return LogLevel::DEBUG;
            if (s == "info")
                return LogLevel::INFO;
            if (s == "ok")
                return LogLevel::OK;
            if (s == "warn")
                return LogLevel::WARN;
            if (s == "error")
                return LogLevel::ERROR;
            return LogLevel::INFO; // Default fallback
        }

        // Lógica central de escritura
        void log(LogLevel level, std::string_view message)
        {
            // Filtrado de nivel (básico)
            if (level < _min_level)
                return;

            // Bloqueo para Thread-Safety (RAII)
            std::lock_guard<std::mutex> lock(_io_mutex);

            // Formato arreglado: [LEVEL] [MODULE] Mensaje
            // Usamos std::cerr para stderr como pide el script
            // std::format es C++20. Si falla, usa fmt::format
            try
            {
                std::cerr << std::format("[{}] [{}] {}\n",
                                         levelToString(level),
                                         _module_name,
                                         message);

                std::cerr.flush(); // Crucial para IPC inmediato
            }
            catch (const std::exception &e)
            {
                // Fallback de emergencia por si falla el formateo
                std::cerr << "[LOG_FAILURE] " << e.what() << "\n";
            }
        }
    };

    // --- Factory Pattern ---

    // Retornamos por valor (RVO optimiza la copia), o podríamos usar unique_ptr
    [[nodiscard]]
    KernelLogger get_kernel_logger(std::optional<std::string> module_name = std::nullopt)
    {
        if (module_name.has_value())
        {
            return KernelLogger(module_name.value());
        }

        const char *env_module = std::getenv("ADC_MODULE_NAME");
        return KernelLogger(env_module ? env_module : "unknown");
    }

} // namespace Core
/*
// --- Main de prueba ---
int main()
{
// Simulamos variables de entorno que tendría Node.js
// En un entorno real, esto viene del sistema.
#ifdef _WIN32
    _putenv("ADC_MODULE_NAME=SensorModule");
    _putenv("ADC_LOG_LEVEL=debug");
#else
    setenv("ADC_MODULE_NAME", "SensorModule", 1);
    setenv("ADC_LOG_LEVEL", "debug", 1);
#endif

    // Obtenemos instancia
    auto logger = Core::get_kernel_logger();

    logger.info("Iniciando módulo nativo C++...");
    logger.ok("Conexión IPC establecida correctamente.");
    logger.warn("Uso de CPU elevado detectado.");
    logger.error("Fallo crítico en el sensor térmico.");

    return 0;
} */