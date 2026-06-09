<!DOCTYPE html>
<html lang="{{ str_replace('_', '-', app()->getLocale()) }}">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>Approval pending - TheSeniorGuru Business</title>
    @vite(['resources/css/app.css', 'resources/js/app.js'])
</head>
<body class="auth-body">
    <main class="auth-card">
        <a class="auth-brand" href="{{ route('login') }}"><span>TSG</span>TheSeniorGuru Business</a>
        <h1>Approval pending</h1>
        <p>Your account was created and is waiting for super admin approval.</p>

        <form method="POST" action="{{ route('logout') }}" class="auth-form">
            @csrf
            <button type="submit">Sign out</button>
        </form>
    </main>
</body>
</html>
