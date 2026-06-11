<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>Senior Living Onboarding | TheSeniorGuru</title>
    @vite(['resources/css/app.css', 'resources/js/app.js'])
</head>
<body class="app-shell">
    <aside class="sidebar">
        <div class="brand">
            <span class="brand-mark">TSG</span>
            <span>TheSeniorGuru</span>
        </div>

        <nav class="nav-list">
            <a href="{{ route('command-center') }}">Command Center</a>
            <a class="active" href="{{ route('business.onboarding.senior-living') }}">Onboarding</a>
            <a href="{{ route('admin.users.index') }}">Admin Approval</a>
        </nav>

        <form method="POST" action="{{ route('logout') }}" class="logout-form">
            @csrf
            <button type="submit">Sign out</button>
        </form>
    </aside>

    <main class="main-content">
        <header class="topbar">
            <div>
                <p class="eyebrow">Shared PostgreSQL</p>
                <h1>Senior Living Onboarding</h1>
                <p class="subcopy">Create a tenant, location, care-level scope, and resident assignments in the shared platform database.</p>
            </div>
            <a class="secondary-link" href="{{ route('command-center') }}">Back to dashboard</a>
        </header>

        @if ($errors->any())
            <section class="alert-panel error-panel">
                <strong>Onboarding could not be submitted.</strong>
                <ul>
                    @foreach ($errors->all() as $error)
                        <li>{{ $error }}</li>
                    @endforeach
                </ul>
            </section>
        @endif

        <form method="POST" action="{{ route('business.onboarding.senior-living.store') }}" class="onboarding-layout">
            @csrf

            <section class="workbench-panel">
                <div class="panel-heading">
                    <div>
                        <p class="eyebrow">Community</p>
                        <h2>Business scope</h2>
                    </div>
                </div>

                <label>
                    Community name
                    <input name="name" value="{{ old('name') }}" required maxlength="180">
                </label>

                <label>
                    Address
                    <textarea name="address" rows="3" maxlength="500">{{ old('address') }}</textarea>
                </label>

                <div class="form-grid">
                    <label>
                        Contact name
                        <input name="contact_name" value="{{ old('contact_name') }}" maxlength="180">
                    </label>
                    <label>
                        Contact email
                        <input type="email" name="contact_email" value="{{ old('contact_email') }}" maxlength="180">
                    </label>
                    <label>
                        Contact phone
                        <input name="contact_phone" value="{{ old('contact_phone') }}" maxlength="40">
                    </label>
                </div>
            </section>

            <section class="workbench-panel">
                <div class="panel-heading">
                    <div>
                        <p class="eyebrow">Care Levels</p>
                        <h2>Resident targets</h2>
                    </div>
                </div>

                <div class="care-level-grid">
                    @foreach ($careLevels as $careLevel)
                        @php($field = $careLevel['code'].'_target')
                        <label class="care-level-card">
                            <span>{{ $careLevel['label'] }}</span>
                            <input type="number" name="{{ $field }}" value="{{ old($field, $careLevel['target']) }}" min="1" max="500" required>
                        </label>
                    @endforeach
                </div>
            </section>

            <section class="workbench-panel import-panel">
                <div class="panel-heading">
                    <div>
                        <p class="eyebrow">Resident Import</p>
                        <h2>CSV or JSON</h2>
                    </div>
                    <span class="source-chip">users + residents + assignments</span>
                </div>

                <label>
                    Resident import
                    <textarea name="resident_import" rows="16" required spellcheck="false" placeholder="display_name,care_level_code,age,room_number,email,phone,external_reference,mobility_notes,cognitive_support">{{ old('resident_import') }}</textarea>
                </label>

                <div class="schema-strip">
                    <span>display_name</span>
                    <span>care_level_code</span>
                    <span>age</span>
                    <span>room_number</span>
                    <span>email</span>
                    <span>phone</span>
                    <span>external_reference</span>
                </div>
            </section>

            <div class="submit-bar">
                <button type="submit">Create community and import residents</button>
            </div>
        </form>
    </main>
</body>
</html>
