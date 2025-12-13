cmake_minimum_required(VERSION 3.14)
project(file-storage)

set(CMAKE_CXX_STANDARD 20)
set(CMAKE_CXX_STANDARD_REQUIRED ON)

# Descargar nlohmann/json automáticamente
include(FetchContent)
FetchContent_Declare(
    json
    URL https://github.com/nlohmann/json/releases/download/v3.11.3/json.tar.xz
)
FetchContent_MakeAvailable(json)

# Agregar directorio de interop C++ a los includes
include_directories("${CMAKE_CURRENT_SOURCE_DIR}/../../../../interfaces/interop/cpp")

# Compilar el ejecutable
add_executable(index index.cpp)

# Enlazar con nlohmann_json
target_link_libraries(index PRIVATE nlohmann_json::nlohmann_json)
