# Use Node.js base image
FROM node:18

# Set the working directory in the container
WORKDIR /app

# Copy package.json and yarn.lock to the working directory
COPY package.json yarn.lock tsconfig.json ./

# Install dependencies
RUN yarn

# Copy Prisma schema to the working directory
COPY src/prisma ./src/prisma

# Copy the rest of the application code to the working directory
COPY . .

# Expose the application port
EXPOSE 5000

# Start the NestJS application
CMD ["npm", "run", "start:prod"]