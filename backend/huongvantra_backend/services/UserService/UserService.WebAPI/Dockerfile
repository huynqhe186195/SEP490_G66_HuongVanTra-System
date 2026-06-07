FROM mcr.microsoft.com/dotnet/sdk:8.0-alpine AS restore
WORKDIR /src

COPY services/UserService/UserService.Domain/UserService.Domain.csproj services/UserService/UserService.Domain/
COPY services/UserService/UserService.Application/UserService.Application.csproj services/UserService/UserService.Application/
COPY services/UserService/UserService.Infrastructure/UserService.Infrastructure.csproj services/UserService/UserService.Infrastructure/
COPY services/UserService/UserService.WebAPI/UserService.WebAPI.csproj services/UserService/UserService.WebAPI/

RUN dotnet restore services/UserService/UserService.WebAPI/UserService.WebAPI.csproj \
    --runtime linux-musl-x64

# ── Stage 2: build ────────────────────────────────────────────────────────────
FROM restore AS build

COPY services/UserService/ services/UserService/

RUN dotnet publish services/UserService/UserService.WebAPI/UserService.WebAPI.csproj \
    -c Release -o /app/publish \
    --no-restore \
    --runtime linux-musl-x64 \
    --self-contained false

# ── Stage 3: final (runtime only — no SDK) ────────────────────────────────────
FROM mcr.microsoft.com/dotnet/aspnet:8.0-alpine AS final

RUN addgroup -S appgroup && adduser -S appuser -G appgroup

WORKDIR /app

COPY --from=build /app/publish .

RUN chown -R appuser:appgroup /app
USER appuser

EXPOSE 8080

ENTRYPOINT ["dotnet", "UserService.WebAPI.dll"]
