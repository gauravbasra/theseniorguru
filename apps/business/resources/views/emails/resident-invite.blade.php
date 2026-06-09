<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Welcome to TheSeniorGuru</title>
<style>
  body { margin: 0; background: #f4f7fc; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; }
  .wrap { max-width: 580px; margin: 40px auto; background: #fff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 24px rgba(0,0,0,.08); }
  .header { background: linear-gradient(135deg, #07162F, #1a3a6b); padding: 32px 36px; }
  .header h1 { margin: 0; color: #fff; font-size: 22px; font-weight: 800; }
  .header p { margin: 6px 0 0; color: rgba(255,255,255,.72); font-size: 14px; }
  .body { padding: 32px 36px; }
  .body p { color: #334e68; font-size: 15px; line-height: 1.6; margin: 0 0 16px; }
  .cred-box { background: #f0f4ff; border: 1px solid #c7d4f5; border-radius: 10px; padding: 20px 24px; margin: 24px 0; }
  .cred-box p { margin: 0 0 8px; font-size: 13px; color: #536182; }
  .cred-box strong { display: block; font-size: 18px; color: #07162F; letter-spacing: .04em; margin-bottom: 4px; }
  .cred-box .note { margin-top: 14px; font-size: 12px; color: #7c8faa; font-style: italic; }
  .btn-row { display: flex; gap: 12px; margin: 28px 0; }
  .btn { display: inline-block; padding: 14px 22px; border-radius: 9px; font-weight: 800; font-size: 14px; text-decoration: none; text-align: center; }
  .btn-apple { background: #000; color: #fff; }
  .btn-google { background: #34A853; color: #fff; }
  .steps { border-left: 3px solid #7048ff; padding-left: 18px; margin: 24px 0; }
  .steps p { margin: 0 0 10px; }
  .steps span { display: inline-block; width: 22px; height: 22px; background: #7048ff; color: #fff; border-radius: 50%; font-size: 11px; font-weight: 900; text-align: center; line-height: 22px; margin-right: 8px; }
  .footer { background: #f8fafc; border-top: 1px solid #e8eef7; padding: 20px 36px; font-size: 12px; color: #7c8faa; }
</style>
</head>
<body>
<div class="wrap">
  <div class="header">
    <h1>Welcome to TheSeniorGuru, {{ $displayName }}!</h1>
    <p>You've been registered by {{ $communityName }}</p>
  </div>
  <div class="body">
    <p>Your community has enrolled you in TheSeniorGuru — a wellness companion app designed specifically for seniors. Download the app and sign in with the credentials below to get started.</p>

    <div class="cred-box">
      <p>Your Login Username</p>
      <strong>{{ $username }}</strong>
      <p style="margin-top:14px;">Your Temporary Password</p>
      <strong>{{ $password }}</strong>
      <p class="note">⚠️ You will be asked to set a new password when you first sign in. This temporary password expires {{ $expiresAt }}.</p>
    </div>

    <p><strong>How to get started:</strong></p>
    <div class="steps">
      <p><span>1</span>Download the TheSeniorGuru app</p>
      <p><span>2</span>Sign in with your username and temporary password</p>
      <p><span>3</span>Set your new permanent password</p>
      <p><span>4</span>Complete your profile and meet your Guru</p>
    </div>

    <div class="btn-row">
      <a href="{{ $appStoreUrl }}" class="btn btn-apple">📱 App Store (iPhone)</a>
      <a href="{{ $playStoreUrl }}" class="btn btn-google">▶ Google Play (Android)</a>
    </div>

    <p>Once you sign in, you'll be automatically connected to <strong>{{ $communityName }}</strong>. Your care team will be able to see your wellness check-ins (with your permission).</p>

    <p>Questions? Ask your community coordinator or reply to this email.</p>
  </div>
  <div class="footer">
    <p>This invite was sent to you because {{ $communityName }} enrolled you in the TheSeniorGuru platform. TheSeniorGuru is HIPAA-compliant and takes your privacy seriously. Your health data is never shared without your consent.</p>
    <p>© {{ date('Y') }} TheSeniorGuru · <a href="https://theseniorguru.com/privacy" style="color:#7c8faa;">Privacy Policy</a></p>
  </div>
</div>
</body>
</html>
