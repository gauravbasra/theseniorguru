<!DOCTYPE html>
<html lang="{{ str_replace('_', '-', app()->getLocale()) }}">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>User approvals - TheSeniorGuru Business</title>
    @vite(['resources/css/app.css', 'resources/js/app.js'])
</head>
<body class="admin-body">
    <main class="admin-shell">
        <header class="admin-header">
            <div>
                <a class="auth-brand" href="{{ route('command-center') }}"><span>TSG</span>TheSeniorGuru Business</a>
                <h1>User approvals</h1>
            </div>
            <form method="POST" action="{{ route('logout') }}">
                @csrf
                <button class="secondary-button" type="submit">Sign out</button>
            </form>
        </header>

        @if (session('status'))
            <p class="flash">{{ session('status') }}</p>
        @endif

        <section class="approval-panel">
            <h2>Pending accounts</h2>
            <div class="approval-list">
                @forelse ($pendingUsers as $user)
                    <article>
                        <div>
                            <strong>{{ $user->name }}</strong>
                            <span>{{ $user->email }}</span>
                        </div>
                        <form method="POST" action="{{ route('admin.users.approve', $user) }}">
                            @csrf
                            <button name="decision" value="approve" type="submit">Approve</button>
                            <button class="danger-button" name="decision" value="reject" type="submit">Reject</button>
                        </form>
                    </article>
                @empty
                    <p>No pending approvals.</p>
                @endforelse
            </div>
        </section>

        <section class="approval-panel">
            <h2>Approved accounts</h2>
            <div class="approval-list">
                @foreach ($approvedUsers as $user)
                    <article>
                        <div>
                            <strong>{{ $user->name }}</strong>
                            <span>{{ $user->email }} - {{ str_replace('_', ' ', $user->role) }}</span>
                        </div>
                        <em>{{ $user->approved_at?->format('M j, Y') ?? 'Seeded' }}</em>
                    </article>
                @endforeach
            </div>
        </section>
    </main>
</body>
</html>
