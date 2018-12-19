FROM node:11.1.0-slim

WORKDIR /usr/src/app

COPY package*.json ./
RUN npm config set @ads:registry https://artifactory.internal.unity3d.com/api/npm/libs-ads/
RUN npm install --production

COPY . .

