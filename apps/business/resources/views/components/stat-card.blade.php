@props(['label', 'value', 'trend', 'tone' => 'blue', 'spark' => ''])

<article class="metric-card {{ $tone }}">
    <div class="metric-top">
        <span class="metric-icon">{{ strtoupper(substr($label, 0, 1)) }}</span>
        <div>
            <span>{{ $label }}</span>
            <strong>{{ $value }}</strong>
            <em>{{ $trend }}</em>
        </div>
    </div>
    <svg viewBox="0 0 384 82" role="img" aria-label="{{ $label }} trend">
        <polyline points="{{ $spark }}" />
    </svg>
</article>
