FROM mcr.microsoft.com/dotnet/sdk:8.0-alpine AS restore
WORKDIR /src

COPY Shared_Libraries/HuongVanTra.Shared/HuongVanTra.Shared.csproj Shared_Libraries/HuongVanTra.Shared/
COPY Service/ProductService/ProductService.Domain/ProductService.Domain.csproj Service/ProductService/ProductService.Domain/
COPY Service/ProductService/ProductService.Application/ProductService.Application.csproj Service/ProductService/ProductService.Application/
COPY Service/ProductService/ProductService.Infrastructure/ProductService.Infrastructure.csproj Service/ProductService/ProductService.Infrastructure/
COPY Service/ProductService/ProductService.WebAPI/ProductService.WebAPI.csproj Service/ProductService/ProductService.WebAPI/

RUN dotnet restore Service/ProductService/ProductService.WebAPI/ProductService.WebAPI.csproj \
    --runtime linux-musl-x64

# ── Stage 2: build ────────────────────────────────────────────────────────────
FROM restore AS build

COPY Service/ProductService/ Service/ProductService/
COPY Shared_Libraries/HuongVanTra.Shared/ Shared_Libraries/HuongVanTra.Shared/

RUN dotnet publish Service/ProductService/ProductService.WebAPI/ProductService.WebAPI.csproj \
    -c Release -o /app/publish \
    --no-restore \
    --runtime linux-musl-x64 \
    --self-contained false

# ── Stage 3: final ────────────────────────────────────────────────────────────
FROM mcr.microsoft.com/dotnet/aspnet:8.0-alpine AS final

RUN apk add --no-cache wget \
    && addgroup -S appgroup && adduser -S appuser -G appgroup

WORKDIR /app

COPY --from=build /app/publish .

RUN chown -R appuser:appgroup /app
USER appuser

EXPOSE 8080

ENTRYPOINT ["dotnet", "ProductService.WebAPI.dll"]
