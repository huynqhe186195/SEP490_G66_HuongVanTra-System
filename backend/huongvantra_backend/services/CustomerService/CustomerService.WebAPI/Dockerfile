FROM mcr.microsoft.com/dotnet/sdk:8.0 AS build
WORKDIR /src

# Copy toàn bộ monorepo vào container (build context = thư mục gốc huongvantra_backend)
COPY . .

WORKDIR /src/services/CustomerService/CustomerService.WebAPI

RUN dotnet restore
RUN dotnet publish -c Release -o /app/publish

FROM mcr.microsoft.com/dotnet/aspnet:8.0 AS final
WORKDIR /app

COPY --from=build /app/publish .

EXPOSE 8080

ENTRYPOINT ["dotnet", "CustomerService.WebAPI.dll"]