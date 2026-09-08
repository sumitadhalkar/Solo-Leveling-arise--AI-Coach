# Local development container only — production frontend is built by Vercel.
FROM node:20-alpine

WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm install --legacy-peer-deps

COPY . .

# Overridable so the dev container can point at a deployed backend:
#   docker build --build-arg REACT_APP_API_URL=https://<host>/api/v1 .
ARG REACT_APP_API_URL=http://localhost:8000/api/v1
ENV REACT_APP_API_URL=$REACT_APP_API_URL

EXPOSE 3000
CMD ["npm", "start"]
