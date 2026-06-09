<!DOCTYPE html>
<html lang="{{ str_replace('_', '-', app()->getLocale()) }}">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>Request access - TheSeniorGuru Business</title>
    @vite(['resources/css/app.css', 'resources/js/app.js'])
</head>
<body class="auth-body">
    <main class="auth-card">
        <a class="auth-brand" href="{{ route('login') }}"><span>TSG</span>TheSeniorGuru Business</a>
        <h1>Request access</h1>
        <p>New accounts stay pending until a super admin approves access.</p>

        <form method="POST" action="{{ route('signup.store') }}" class="auth-form">
            @csrf
            <label>
                Name
                <input name="name" value="{{ old('name') }}" required autocomplete="name">
                @error('name') <small>{{ $message }}</small> @enderror
            </label>
            <label>
                Email
                <input name="email" type="email" value="{{ old('email') }}" required autocomplete="email">
                @error('email') <small>{{ $message }}</small> @enderror
            </label>
            <label>
                Password
                <input name="password" type="password" required autocomplete="new-password">
                @error('password') <small>{{ $message }}</small> @enderror
            </label>
            <label>
                Confirm password
                <input name="password_confirmation" type="password" required autocomplete="new-password">
            </label>
            <button type="submit">Create pending account</button>
        </form>

        <a class="auth-link" href="{{ route('login') }}">Back to sign in</a>
    </main>
</body>
</html>
