<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>Verification Documents | TheSeniorGuru</title>@vite(['resources/css/app.css', 'resources/js/app.js'])</head>
<body class="auth-body" style="display:block; padding:40px 20px;">
<div style="max-width:780px; margin:0 auto;">
    <a class="auth-brand" href="/" style="display:inline-flex; margin-bottom:32px;"><span>TSG</span><strong style="margin-left:10px; font-size:18px;">TheSeniorGuru</strong></a>
    @include('onboarding._progress', ['step' => 5])

    <div class="workbench-panel" style="grid-column:span 6; margin-top:24px;">
        <div class="panel-heading"><div>
            <h2>Verification Documents</h2>
            <p class="subcopy">Upload your required documents for verification. Max 10 MB per file. Accepted: PDF, JPG, PNG, DOC, DOCX.</p>
        </div></div>

        @if (session('status'))
            <div class="alert-panel" style="border-color:#c9f0d8; background:#f1fff6; color:#116b3f; border-radius:9px; padding:14px; margin-bottom:16px;">✅ {{ session('status') }}</div>
        @endif
        @if ($errors->any())
            <div class="alert-panel error-panel"><ul>@foreach ($errors->all() as $e)<li>{{ $e }}</li>@endforeach</ul></div>
        @endif

        {{-- Required documents checklist --}}
        <div style="margin-bottom:24px;">
            <h3 style="font-size:14px; margin-bottom:12px;">Required for {{ \App\Models\BusinessOnboardingProfile::TYPES[$profile->business_type] ?? '' }}</h3>
            <div style="display:grid; gap:8px;">
                @foreach ($required as $req)
                    @php $uploaded = $documents->where('document_type', $req)->first(); @endphp
                    <div style="display:flex; align-items:center; gap:10px; font-size:13px; padding:10px 14px; border-radius:8px; border:1px solid {{ $uploaded ? '#c9f0d8' : 'var(--line)' }}; background:{{ $uploaded ? '#f1fff6' : '#fafcff' }};">
                        <span>{{ $uploaded ? '✅' : '⬜' }}</span>
                        <strong>{{ \App\Models\BusinessVerificationDocument::TYPES[$req] ?? $req }}</strong>
                        @if ($uploaded)
                            <span style="color:var(--muted); margin-left:auto;">{{ $uploaded->file_name }} · {{ $uploaded->status }}</span>
                        @else
                            <span style="color:var(--red); margin-left:auto; font-size:12px;">Required — not yet uploaded</span>
                        @endif
                    </div>
                @endforeach
            </div>
        </div>

        {{-- Upload form --}}
        <form method="POST" action="{{ route('onboarding.step5.post', $profile) }}" enctype="multipart/form-data" style="border:1px solid var(--line); border-radius:10px; padding:20px; background:#fff;">
            @csrf
            <h3 style="margin:0 0 14px; font-size:14px;">Upload a Document</h3>
            <div class="form-grid" style="grid-template-columns:1fr 1fr; gap:14px;">
                <label>Document Type <span style="color:var(--red);">*</span>
                    <select name="document_type" required>
                        <option value="">Select type…</option>
                        @foreach (\App\Models\BusinessVerificationDocument::TYPES as $val => $lbl)
                            <option value="{{ $val }}" {{ old('document_type') === $val ? 'selected' : '' }}>{{ $lbl }}</option>
                        @endforeach
                    </select>
                </label>
                <label>File <span style="color:var(--red);">*</span>
                    <input type="file" name="document_file" accept=".pdf,.jpg,.jpeg,.png,.doc,.docx" required style="padding:10px;">
                </label>
            </div>
            <button type="submit" style="margin-top:14px; border:0; border-radius:8px; background:var(--ink); color:#fff; cursor:pointer; padding:11px 16px; font-weight:900;">Upload Document</button>
        </form>

        {{-- Already uploaded list --}}
        @if ($documents->count() > 0)
            <div style="margin-top:20px;">
                <h3 style="font-size:14px; margin-bottom:10px;">Uploaded Documents</h3>
                <div style="display:grid; gap:8px;">
                    @foreach ($documents as $doc)
                        <div style="display:flex; align-items:center; gap:12px; padding:10px 14px; border:1px solid var(--line); border-radius:8px; font-size:13px;">
                            <span>📄</span>
                            <div style="flex:1;">
                                <strong>{{ $doc->document_label ?? $doc->document_type }}</strong>
                                <small style="display:block; color:var(--muted);">{{ $doc->file_name }} · {{ number_format($doc->file_size_bytes / 1024, 1) }} KB · {{ $doc->created_at->format('M j, Y') }}</small>
                            </div>
                            <span class="status {{ $doc->status === 'verified' ? 'stable' : ($doc->status === 'rejected' ? 'alert' : 'pending') }}">{{ $doc->status }}</span>
                        </div>
                    @endforeach
                </div>
            </div>
        @endif

        <div style="display:flex; justify-content:space-between; margin-top:28px;">
            <a href="{{ route('onboarding.step4', $profile) }}" class="secondary-link">← Back</a>
            <div style="display:flex; gap:12px;">
                <a href="{{ route('onboarding.step5.skip', $profile) }}" class="secondary-link">Skip for now</a>
                <a href="{{ route('onboarding.step6', $profile) }}" style="border:0; border-radius:8px; background:var(--blue); color:#fff; padding:12px 20px; font-weight:900; text-decoration:none;">Continue to Review →</a>
            </div>
        </div>
    </div>
</div>
</body>
</html>
