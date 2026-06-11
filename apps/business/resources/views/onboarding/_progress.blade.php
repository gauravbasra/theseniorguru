@php
$steps = ['Type', 'Profile', 'Details', 'HIPAA', 'Documents', 'Review'];
@endphp
<div style="display:flex; gap:0; margin-bottom:8px;">
    @foreach ($steps as $i => $label)
        @php $num = $i + 1; $active = $step === $num; $done = $step > $num; @endphp
        <div style="flex:1; text-align:center;">
            <div style="display:flex; align-items:center;">
                @if ($i > 0)<div style="flex:1; height:2px; background:{{ $done ? '#7048ff' : 'var(--line)' }};"></div>@endif
                <div style="width:32px; height:32px; border-radius:50%; display:inline-flex; align-items:center; justify-content:center; font-size:13px; font-weight:900; flex-shrink:0;
                    background:{{ $done ? '#7048ff' : ($active ? '#7048ff' : 'var(--line)') }};
                    color:{{ ($done || $active) ? '#fff' : 'var(--muted)' }};">
                    {{ $done ? '✓' : $num }}
                </div>
                @if ($i < count($steps)-1)<div style="flex:1; height:2px; background:{{ $done ? '#7048ff' : 'var(--line)' }};"></div>@endif
            </div>
            <div style="font-size:11px; margin-top:5px; color:{{ ($active || $done) ? '#7048ff' : 'var(--muted)' }}; font-weight:{{ $active ? '800' : '500' }};">{{ $label }}</div>
        </div>
    @endforeach
</div>
