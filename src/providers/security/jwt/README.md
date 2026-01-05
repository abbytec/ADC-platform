# JWT Provider

Cifrado y descifrado de tokens JWT usando jose (JWE).

## Uso

```typescript
const jwt = kernel.getProvider<IJWTProvider>("jwt");

// Cifrar
const token = await jwt.encrypt({ userId: "123", permissions: ["users.read"] });

// Descifrar
const { valid, payload } = await jwt.decrypt(token);
```

## Configuración

Requiere `JWT_SECRET` en variables de entorno (mínimo 32 caracteres).
