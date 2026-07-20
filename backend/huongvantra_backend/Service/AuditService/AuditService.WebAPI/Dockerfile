FROM mcr.microsoft.com/dotnet/sdk:8.0-alpine AS restore
WORKDIR /src

COPY Shared_Libraries/HuongVanTra.Shared/HuongVanTra.Shared.csproj Shared_Libraries/HuongVanTra.Shared/
COPY Service/AuditService/AuditService.Domain/AuditService.Domain.csproj Service/AuditService/AuditService.Domain/
COPY Service/AuditService/AuditService.Application/AuditService.Application.csproj Service/AuditService/AuditService.Application/
COPY Service/AuditService/AuditService.Infrastructure/AuditService.Infrastructure.csproj Service/AuditService/AuditService.Infrastructure/
COPY Service/AuditService/AuditService.WebAPI/AuditService.WebAPI.csproj Service/AuditService/AuditService.WebAPI/

RUN dotnet restore Service/AuditService/AuditService.WebAPI/AuditService.WebAPI.csproj \
    --runtime linux-musl-x64

FROM restore AS build

COPY Service/AuditService/ Service/AuditService/
COPY Shared_Libraries/HuongVanTra.Shared/ Shared_Libraries/HuongVanTra.Shared/

RUN dotnet publish Service/AuditService/AuditService.WebAPI/AuditService.WebAPI.csproj \
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

ENTRYPOINT ["dotnet", "AuditService.WebAPI.dll"]
