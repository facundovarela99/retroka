export class AppError extends Error {
    error;
    message;
    statusCode;
    constructor(error, message, statusCode) {
        super(message);
        this.error = error;
        this.statusCode = statusCode;
        this.message = message;
    }
}