# Dockerfile для разработки Ethereum смарт-контрактов с Hardhat
FROM node:20-slim

# Метаинформация
LABEL maintainer="CryptoFiat Dev Team"
LABEL description="Development environment for Ethereum smart contracts with Hardhat"

# Создание рабочей директории
WORKDIR /app

# Копирование package.json и package-lock.json
COPY package*.json ./

# Установка Node.js зависимостей
RUN npm ci --prefer-offline --no-audit || npm install --no-audit

# Копирование остальных файлов проекта
COPY . .

# Создание директорий для Hardhat если их нет
RUN mkdir -p contracts test scripts cache artifacts

# Экспонирование порта для Hardhat Network
EXPOSE 8545

# Команда по умолчанию - запуск Hardhat Network
CMD ["npm", "run", "node"]
