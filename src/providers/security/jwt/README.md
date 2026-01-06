# JWT Provider

Cifrado y descifrado de tokens JWT usando jose (JWE). Soporta rotación de claves.

## Uso básico

```typescript
const jwt = kernel.getProvider<IJWTProvider>("jwt");
const token = await jwt.encrypt({ userId: "123", permissions: ["users.read"] });
const { valid, payload } = await jwt.decrypt(token);
```

## Uso con rotación de claves

```typescript
const jwt = kernel.getProvider<IJWTProviderMultiKey>("jwt");
// Cifrar con clave específica
const token = await jwt.encryptWithKey(payload, keyBytes, "15m");
// Descifrar con clave específica
const result = await jwt.decryptWithKey(token, keyBytes);
```

Requiere secret JWT a menos que se quiera utilizar la rotación de claves.

## Configuraciones admitidas para el constructor:

jwtSecret: Clave de 32 caracteres como mínimo
