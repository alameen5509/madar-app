namespace Madar.Application.Common.Models;

public class Result<T>
{
    public bool Succeeded { get; private set; }
    public T? Data { get; private set; }
    public string? Message { get; private set; }
    public List<string> Errors { get; private set; } = new();

    public static Result<T> Success(T data, string? message = null) =>
        new() { Succeeded = true, Data = data, Message = message };

    public static Result<T> Failure(string error) =>
        new() { Succeeded = false, Errors = new List<string> { error } };

    public static Result<T> Failure(List<string> errors) =>
        new() { Succeeded = false, Errors = errors };
}

public class Result
{
    public bool Succeeded { get; private set; }
    public string? Message { get; private set; }
    public List<string> Errors { get; private set; } = new();

    public static Result Success(string? message = null) =>
        new() { Succeeded = true, Message = message };

    public static Result Failure(string error) =>
        new() { Succeeded = false, Errors = new List<string> { error } };

    public static Result Failure(List<string> errors) =>
        new() { Succeeded = false, Errors = errors };
}
