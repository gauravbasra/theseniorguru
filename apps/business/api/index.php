<?php

$storage = '/tmp/laravel-storage';

foreach ([
    "{$storage}/framework/cache/data",
    "{$storage}/framework/sessions",
    "{$storage}/framework/views",
    "{$storage}/logs",
] as $directory) {
    if (! is_dir($directory)) {
        mkdir($directory, 0777, true);
    }
}

$runtimeDefaults = [
    'LARAVEL_STORAGE_PATH' => $storage,
    'VIEW_COMPILED_PATH' => "{$storage}/framework/views",
    'CACHE_STORE' => $_ENV['CACHE_STORE'] ?? $_SERVER['CACHE_STORE'] ?? 'array',
    'SESSION_DRIVER' => $_ENV['SESSION_DRIVER'] ?? $_SERVER['SESSION_DRIVER'] ?? 'cookie',
];

foreach ($runtimeDefaults as $key => $value) {
    $_ENV[$key] = $value;
    $_SERVER[$key] = $value;
    putenv("{$key}={$value}");
}

require __DIR__.'/../public/index.php';
