<?php

namespace App\Support;

use Illuminate\Support\Facades\DB;

class SharedPlatformContract
{
    /**
     * @return array{connection:string,database:?string,host:?string,engine:?string,required:array<int,string>,missing:array<int,string>,temporary:array<int,string>,node_owned:array<int,string>,laravel_operations:array<int,string>}
     */
    public function audit(): array
    {
        $connection = DB::connection('shared_platform');
        $schema = $this->publicRelations();
        $required = config('shared_platform.required_tables', []);
        $temporary = config('shared_platform.temporary_portal_only_tables', []);

        return [
            'connection' => $connection->getName(),
            'database' => $connection->getDatabaseName(),
            'host' => config('database.connections.shared_platform.host'),
            'engine' => config('database.connections.shared_platform.driver'),
            'required' => $required,
            'missing' => array_values(array_diff($required, $schema)),
            'temporary' => array_values(array_intersect($temporary, $schema)),
            'node_owned' => config('shared_platform.node_owned_tables', []),
            'laravel_operations' => config('shared_platform.laravel_operations_tables', []),
        ];
    }

    /**
     * @return array<int,string>
     */
    private function publicRelations(): array
    {
        return DB::connection('shared_platform')->table('information_schema.tables')
            ->where('table_schema', 'public')
            ->whereIn('table_type', ['BASE TABLE', 'VIEW'])
            ->orderBy('table_name')
            ->pluck('table_name')
            ->all();
    }
}
