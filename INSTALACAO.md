# Logistica Pro - Guia de Instalacao 
 
## Pre-requisitos 
 
- Node.js 18+ instalado 
- MySQL 8.0+ instalado e rodando 
- Porta 5000 disponivel para o backend 
 
## Instalacao 
 
### 1. Configurar Banco de Dados 
 
```sql 
CREATE DATABASE IF NOT EXISTS logistica_pro; 
``` 
 
### 2. Configurar Backend 
 
1. Entre na pasta backend 
2. Copie .env.example para .env 
3. Edite o .env com suas configuracoes 
 
### 3. Instalar Dependencias 
 
```bash 
cd backend 
npm install --production 
``` 
 
### 4. Iniciar Sistema 
 
**Windows:** 
```bash 
start-windows.bat 
``` 
 
**Linux:** 
```bash 
chmod +x start-linux.sh 
./start-linux.sh 
``` 
 
### 5. Acessar Sistema 
 
Backend API: http://localhost:5000 
Frontend: Servir pasta frontend/ com um servidor web 
