@extends('layouts.app')

@section('content')
<div class="panel-heading" style="margin-bottom:20px;">
    <div>
        <h1 class="page-title">Import Residents</h1>
        <p class="subcopy">Bulk-import residents via CSV. Download the template, fill it in, and upload.</p>
    </div>
    <a href="{{ route('residents.import.template') }}" style="display:inline-flex; align-items:center; gap:6px; border:1px solid var(--line); border-radius:8px; background:#fff; padding:10px 14px; font-size:13px; font-weight:700; text-decoration:none; color:var(--ink);">
        ⬇ Download CSV Template
    </a>
</div>

@if (session('import_result'))
    @php $result = session('import_result'); @endphp
    <div class="workbench-panel" style="margin-bottom:20px; border-color:{{ $result['errors_count'] === 0 ? '#c9f0d8' : '#ffe08a' }}; background:{{ $result['errors_count'] === 0 ? '#f1fff6' : '#fffbea' }};">
        <strong>Import complete:</strong>
        {{ $result['imported'] }} imported, {{ $result['skipped'] }} skipped, {{ $result['errors_count'] }} errors.
        @if ($result['batch_id'])
            &nbsp;·&nbsp; <a href="{{ route('residents.invites', ['batch_id' => $result['batch_id']]) }}">View invites →</a>
        @endif
        @if (!empty($result['row_errors']))
            <ul style="margin:12px 0 0; font-size:12px; color:var(--red);">
                @foreach ($result['row_errors'] as $err)<li>{{ $err }}</li>@endforeach
            </ul>
        @endif
    </div>
@endif

@if ($errors->any())
    <div class="alert-panel error-panel" style="margin-bottom:16px;"><ul>@foreach ($errors->all() as $e)<li>{{ $e }}</li>@endforeach</ul></div>
@endif

<div style="display:grid; grid-template-columns:1fr 1fr; gap:20px;">

    {{-- Upload card --}}
    <div class="workbench-panel" style="grid-column:span 2 / span 2;">
        <div class="panel-heading"><div><h3>Upload CSV File</h3></div></div>
        <form method="POST" action="{{ route('residents.import.upload') }}" enctype="multipart/form-data">
            @csrf
            <div style="border:2px dashed var(--line); border-radius:10px; padding:32px; text-align:center; background:#fafcff; margin-bottom:16px;" id="drop-zone">
                <div style="font-size:36px; margin-bottom:12px;">📂</div>
                <p style="margin:0 0 10px; font-weight:700;">Drop your CSV here or click to browse</p>
                <p style="margin:0 0 16px; font-size:12px; color:var(--muted);">Max 5 MB · CSV format only</p>
                <input type="file" name="csv_file" id="csv_file" accept=".csv" required style="display:none;">
                <label for="csv_file" style="border:0; border-radius:8px; background:var(--ink); color:#fff; padding:10px 18px; font-weight:700; cursor:pointer;">Choose File</label>
                <span id="file-name" style="display:block; margin-top:10px; font-size:13px; color:var(--muted);"></span>
            </div>

            @if ($communities->count() > 0)
                <label style="display:block; margin-bottom:14px;">
                    <strong>Community / Location</strong>
                    <select name="community_id" required style="display:block; width:100%; margin-top:6px;">
                        <option value="">Select community…</option>
                        @foreach ($communities as $c)
                            <option value="{{ $c->id }}">{{ $c->name }}</option>
                        @endforeach
                    </select>
                </label>
            @endif

            <button type="submit" style="width:100%; border:0; border-radius:8px; background:#7048ff; color:#fff; cursor:pointer; padding:13px; font-size:15px; font-weight:900;">
                Import & Generate Invites
            </button>
        </form>
    </div>

    {{-- CSV format guide --}}
    <div class="workbench-panel">
        <div class="panel-heading"><div><h3>CSV Column Reference</h3></div></div>
        <table style="width:100%; font-size:12px; border-collapse:collapse;">
            <thead><tr style="border-bottom:1px solid var(--line);">
                <th style="text-align:left; padding:6px 0;">Column</th>
                <th style="text-align:left; padding:6px 0;">Required</th>
                <th style="text-align:left; padding:6px 0;">Notes</th>
            </tr></thead>
            <tbody>
                @foreach ([
                    ['display_name','Yes','Full name of resident'],
                    ['care_level_code','Yes','assisted_living, independent_living, memory_care'],
                    ['room_number','No','Room or unit number'],
                    ['age','No','Numeric age'],
                    ['email','No','For invite delivery'],
                    ['phone','No','For SMS invite (future)'],
                    ['external_reference','No','Your CRM ID for this resident'],
                    ['mobility_notes','No','e.g. wheelchair, walker'],
                    ['cognitive_support','No','e.g. mild, moderate, severe'],
                ] as [$col, $req, $note])
                <tr style="border-bottom:1px solid var(--line);">
                    <td style="padding:7px 0; font-family:monospace; font-size:11px; color:var(--blue);">{{ $col }}</td>
                    <td style="padding:7px 0; color:{{ $req === 'Yes' ? 'var(--red)' : 'var(--muted)' }};">{{ $req }}</td>
                    <td style="padding:7px 0; color:var(--muted);">{{ $note }}</td>
                </tr>
                @endforeach
            </tbody>
        </table>
    </div>

    {{-- Recent batches --}}
    @if ($recentBatches->count() > 0)
    <div class="workbench-panel">
        <div class="panel-heading"><div><h3>Recent Imports</h3></div></div>
        <div style="display:grid; gap:8px; font-size:13px;">
            @foreach ($recentBatches as $batch)
                <div style="display:flex; align-items:center; gap:10px; padding:10px 0; border-bottom:1px solid var(--line);">
                    <div style="flex:1;">
                        <strong>{{ $batch->imported_count }} residents</strong>
                        <small style="display:block; color:var(--muted);">{{ $batch->created_at->format('M j, Y g:i A') }}</small>
                    </div>
                    <a href="{{ route('residents.invites', ['batch_id' => $batch->id]) }}" style="font-size:12px; color:var(--blue); text-decoration:none;">View invites</a>
                </div>
            @endforeach
        </div>
    </div>
    @endif

</div>

<script>
document.getElementById('csv_file').addEventListener('change', function(e) {
    const name = e.target.files[0]?.name ?? '';
    document.getElementById('file-name').textContent = name;
});
const dz = document.getElementById('drop-zone');
dz.addEventListener('dragover', e => { e.preventDefault(); dz.style.borderColor = '#7048ff'; });
dz.addEventListener('dragleave', () => { dz.style.borderColor = 'var(--line)'; });
dz.addEventListener('drop', e => {
    e.preventDefault(); dz.style.borderColor = 'var(--line)';
    const file = e.dataTransfer.files[0];
    if (file) {
        const inp = document.getElementById('csv_file');
        const dt = new DataTransfer(); dt.items.add(file); inp.files = dt.files;
        document.getElementById('file-name').textContent = file.name;
    }
});
</script>
@endsection
