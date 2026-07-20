FROM mcr.microsoft.com/dotnet/sdk:8.0-alpine AS restore
WORKDIR /src

COPY Shared_Libraries/HuongVanTra.Shared/HuongVanTra.Shared.csproj Shared_Libraries/HuongVanTra.Shared/
COPY Service/UserService/UserService.Domain/UserService.Domain.csproj Service/UserService/UserService.Domain/
COPY Service/UserService/UserService.Application/UserService.Application.csproj Service/UserService/UserService.Application/
COPY Service/UserService/UserService.Infrastructure/UserService.Infrastructure.csproj Service/UserService/UserService.Infrastructure/
COPY Service/UserService/UserService.WebAPI/UserService.WebAPI.csproj Service/UserService/UserService.WebAPI/

RUN dotnet restore Service/UserService/UserService.WebAPI/UserService.WebAPI.csproj \
    --runtime linux-musl-x64

# ── Stage 2: build ────────────────────────────────────────────────────────────
FROM restore AS build

COPY Service/UserService/ Service/UserService/
COPY Shared_Libraries/HuongVanTra.Shared/ Shared_Libraries/HuongVanTra.Shared/

RUN dotnet publish Service/UserService/UserService.WebAPI/UserService.WebAPI.csproj \
    -c Release -o /app/publish \
    --no-restore \
    --runtime linux-musl-x64 \
    --self-contained false

# ── Stage 3: final (runtime only — no SDK) ────────────────────────────────────
FROM mcr.microsoft.com/dotnet/aspnet:8.0-alpine AS final

RUN apk add --no-cache wget \
    && addgroup -S appgroup && adduser -S appuser -G appgroup

WORKDIR /app

COPY --from=build /app/publish .

RUN chown -R appuser:appgroup /app
USER appuser

EXPOSE 8080

ENTRYPOINT ["dotnet", "UserService.WebAPI.dll"]
