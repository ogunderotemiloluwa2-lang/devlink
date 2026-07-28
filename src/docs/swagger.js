const swaggerJsdoc = require("swagger-jsdoc");
const { apiUrl } = require("../config/env");

const options = {
  definition: {
    openapi: "3.0.3",
    info: {
      title: "DevLink API",
      version: "1.0.0",
      description:
        "REST API for DevLink — a developer network for sharing projects, finding collaborators, discovering AI tools, and joining communities.",
      contact: { name: "DevLink Engineering" },
    },
    servers: [
      { url: `${apiUrl}/api/v1`, description: "Current environment" },
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: "http",
          scheme: "bearer",
          bearerFormat: "JWT",
        },
      },
    },
    security: [{ bearerAuth: [] }],
  },
  apis: ["./src/routes/*.js", "./src/docs/schemas/*.js"],
};

module.exports = swaggerJsdoc(options);
