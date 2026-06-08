FROM mcr.microsoft.com/dotnet/sdk:8.0-alpine AS restore
WORKDIR /src

COPY Shared_Libraries/HuongVanTra.Shared/HuongVanTra.Shared.csproj Shared_Libraries/HuongVanTra.Shared/
COPY Service/InventoryService/InventoryService.Domain/InventoryService.Domain.csproj Service/InventoryService/InventoryService.Domain/
COPY Service/InventoryService/InventoryService.Application/InventoryService.Application.csproj Service/InventoryService/InventoryService.Application/
COPY Service/InventoryService/InventoryService.Infrastructure/InventoryService.Infrastructure.csproj Service/InventoryService/InventoryService.Infrastructure/
COPY Service/InventoryService/InventoryService.WebAPI/InventoryService.WebAPI.csproj Service/InventoryService/InventoryService.WebAPI/

RUN dotnet restore Service/InventoryService/InventoryService.WebAPI/InventoryService.WebAPI.csproj \
    --runtime linux-musl-x64

FROM restore AS build

COPY Service/InventoryService/ Service/InventoryService/
COPY Shared_Libraries/HuongVanTra.Shared/ Shared_Libraries/HuongVanTra.Shared/

RUN dotnet publish Service/InventoryService/InventoryService.WebAPI/InventoryService.WebAPI.csproj \
    -c Release -o /app/publish \
    --no-restore \
    --runtime linux-musl-x64 \
    --self-contained false

FROM mcr.microsoft.com/dotnet/aspnet:8.0-alpine AS final

RUN apk add --no-cache wget \
    && addgroup -S appgroup && adduser -S appuser -G appgroup

WORKDIR /app

COPY --from=build /app/publish .

RUN chown -R appuser:appgroup /app
USER appuser

EXPOSE 8080

ENTRYPOINT ["dotnet", "InventoryService.WebAPI.dll"]
