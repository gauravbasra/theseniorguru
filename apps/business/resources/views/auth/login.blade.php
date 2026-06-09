<!DOCTYPE html>
<html lang="{{ str_replace('_', '-', app()->getLocale()) }}">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>Sign in - TheSeniorGuru Business</title>
    @vite(['resources/css/app.css', 'resources/js/app.js'])
</head>
<body class="auth-body">
    <main class="auth-card">
        <a class="auth-brand" href="{{ route('login') }}"><span>TSG</span>TheSeniorGuru Business</a>
        <h1>Sign in</h1>
        <p>Access is limited to approved community and business operators.</p>

        <form method="POST" action="{{ route('login.store') }}" class="auth-form">
            @csrf
            <label>
                Email
                <input name="email" type="email" value="{{ old('email') }}" required autofocus autocomplete="email">
                @error('email') <small>{{ $message }}</small> @enderror
            </label>
            <label>
                Password
                <input name="password" type="password" required autocomplete="current-password">
                @error('password') <small>{{ $message }}</small> @enderror
            </label>
            <label class="check-row">
                <input name="remember" type="checkbox" value="1">
                Keep me signed in
            </label>
            <button type="submit">Sign in</button>
        </form>

        <a class="auth-link" href="{{ route('signup') }}">Request business access</a>
    </main>
</body>
</html>
