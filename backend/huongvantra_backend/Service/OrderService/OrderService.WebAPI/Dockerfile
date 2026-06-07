FROM mcr.microsoft.com/dotnet/sdk:8.0-alpine AS restore
WORKDIR /src

COPY Shared_Libraries/HuongVanTra.Shared/HuongVanTra.Shared.csproj Shared_Libraries/HuongVanTra.Shared/
COPY Service/OrderService/OrderService.Domain/OrderService.Domain.csproj Service/OrderService/OrderService.Domain/
COPY Service/OrderService/OrderService.Application/OrderService.Application.csproj Service/OrderService/OrderService.Application/
COPY Service/OrderService/OrderService.Infrastructure/OrderService.Infrastructure.csproj Service/OrderService/OrderService.Infrastructure/
COPY Service/OrderService/OrderService.WebAPI/OrderService.WebAPI.csproj Service/OrderService/OrderService.WebAPI/

RUN dotnet restore Service/OrderService/OrderService.WebAPI/OrderService.WebAPI.csproj \
    --runtime linux-musl-x64

FROM restore AS build

COPY Service/OrderService/ Service/OrderService/
COPY Shared_Libraries/HuongVanTra.Shared/ Shared_Libraries/HuongVanTra.Shared/

RUN dotnet publish Service/OrderService/OrderService.WebAPI/OrderService.WebAPI.csproj \
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

ENTRYPOINT ["dotnet", "OrderService.WebAPI.dll"]
