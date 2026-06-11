<?php

use Illuminate\Foundation\Inspiring;
use Illuminate\Support\Facades\Artisan;
use App\Support\SharedPlatformContract;

Artisan::command('inspire', function () {
    $this->comment(Inspiring::quote());
})->purpose('Display an inspiring quote');

Artisan::command('tsg:audit-shared-database', function (SharedPlatformContract $contract) {
    $audit = $contract->audit();

    $this->line('TSG shared database audit');
    $this->line('Connection: '.$audit['connection']);
    $this->line('Engine: '.$audit['engine']);
    $this->line('Database: '.($audit['database'] ?? 'unknown'));
    $this->line('Host: '.($audit['host'] ?? 'unknown'));

    if ($audit['missing'] !== []) {
        $this->error('Missing required shared tables: '.implode(', ', $audit['missing']));
    } else {
        $this->info('All required shared tables are present.');
    }

    if ($audit['temporary'] !== []) {
        $this->warn('Temporary portal-only tables detected: '.implode(', ', $audit['temporary']));
    }

    $this->line('Node-owned intelligence tables: '.implode(', ', $audit['node_owned']));
    $this->line('Laravel operations tables: '.implode(', ', $audit['laravel_operations']));

    return $audit['missing'] === [] ? self::SUCCESS : self::FAILURE;
})->purpose('Verify that Laravel is connected to the TSG shared PostgreSQL contract');
