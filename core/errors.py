class AppError(Exception):
    status=400
class NotFoundError(AppError): status=404
class ValidationError(AppError): status=400
class ConflictError(AppError): status=409
