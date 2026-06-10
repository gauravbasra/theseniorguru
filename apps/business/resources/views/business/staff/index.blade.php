@extends('layouts.app')

@section('title', 'Staff & Care Tasks')

@section('content')
    <section class="page-title">
        <div>
            <h1>Staff & Care Tasks</h1>
            <p>Care team roster and the live task queue: assign, acknowledge, resolve, or escalate to NOC.</p>
        </div>
        <div class="source-chip-row">
            @foreach ($sourceTables as $table)
                <code>{{ $table }}</code>
            @endforeach
        </div>
    </section>

    @if (session('status'))
        <div class="alert-panel success-panel">{{ session('status') }}</div>
    @endif

    @if ($errors->any())
        <div class="alert-panel error-panel">
            <strong>Task action was not recorded.</strong>
            <ul>
                @foreach ($errors->all() as $error)
                    <li>{{ $error }}</li>
                @endforeach
            </ul>
        </div>
    @endif

    <section class="panel module-panel">
        <div class="panel-header">
            <h2>Care team roster</h2>
            <span>{{ count($roster) }} active</span>
        </div>

        @if (empty($roster))
            <div class="empty-state">
                <strong>No staff profiles are configured yet.</strong>
                <span>Add care team members to <code>staff_profiles</code> so tasks can be assigned and routed.</span>
            </div>
        @else
            <div class="request-list">
                @foreach ($roster as $member)
                    <div>
                        <strong>{{ $member->display_name }}</strong>
                        <span>{{ $member->role_name }} @if($member->department) · {{ $member->department }} @endif</span>
                    </div>
                @endforeach
            </div>
        @endif
    </section>

    <section class="panel module-panel">
        <div class="panel-header">
            <h2>Task queue</h2>
            <span>{{ count($tasks) }} loaded</span>
        </div>

        @if (empty($tasks))
            <div class="empty-state">
                <strong>No staff tasks are currently in scope.</strong>
                <span>Tasks are created automatically when alerts are assigned, Guru recommendations are actioned, or staff escalate to NOC.</span>
                <code>staff_tasks</code>
            </div>
        @else
            <div class="alert-work-list">
                @foreach ($tasks as $task)
                    <article class="alert-work-item">
                        <div class="alert-work-main">
                            <span class="status {{ strtolower((string) $task->priority) }}">{{ $task->priority }}</span>
                            <div>
                                <h2>{{ $task->title ?? 'Care task' }}</h2>
                                <p>{{ $task->body ?? 'No additional details were supplied.' }}</p>
                                <small>
                                    {{ $task->resident_name ?? 'Unassigned resident' }}
                                    @if ($task->room_number)
                                        · Room {{ $task->room_number }}
                                    @endif
                                    · status: {{ $task->status ?? 'open' }}
                                    · assigned to: {{ $task->assignee_name ?? 'Unassigned' }}{{ $task->assignee_role ? ' ('.$task->assignee_role.')' : '' }}
                                    @if ($task->due_at)
                                        · due {{ $task->due_at }}
                                    @endif
                                    · source: {{ $task->source_type }}
                                </small>
                            </div>
                        </div>

                        @if (in_array($task->status, ['open', 'accepted', 'snoozed'], true))
                            <form method="POST" action="{{ route('business.staff.tasks.action', $task->id) }}" class="triage-form">
                                @csrf
                                <label>
                                    Action
                                    <select name="action" required>
                                        @if ($task->status === 'open')
                                            <option value="accept">Acknowledge & start</option>
                                        @endif
                                        <option value="resolve">Mark resolved</option>
                                        <option value="snooze">Snooze 2 hours</option>
                                        <option value="escalate">Escalate to NOC</option>
                                    </select>
                                </label>
                                <label>
                                    Note
                                    <textarea name="note" rows="2" maxlength="2000" placeholder="e.g. visited resident, vitals checked, medication administered..."></textarea>
                                </label>
                                <button type="submit">Update task</button>
                            </form>
                        @else
                            <div class="empty-state">
                                <strong>{{ ucfirst((string) $task->status) }}</strong>
                                <span>
                                    @if ($task->resolved_at)
                                        Resolved {{ $task->resolved_at }}
                                    @else
                                        No further action needed.
                                    @endif
                                </span>
                            </div>
                        @endif
                    </article>
                @endforeach
            </div>
        @endif
    </section>
@endsection
