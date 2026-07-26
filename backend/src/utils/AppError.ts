export class AppError extends Error {
  constructor(
    public code: number,
    message: string,
  ) {
    super(message)
    this.name = 'AppError'
  }
}
