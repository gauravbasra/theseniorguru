# Deployment Plan

The Senior Guru should deploy alongside existing apps without touching TheVaulted.

## Server Isolation

- App path: `/opt/theseniorguru`
- Container: `theseniorguru-web`
- Internal app port: `3000`
- Host port: `3051`
- Nginx site: `/etc/nginx/sites-available/theseniorguru`
- Env file: `/opt/theseniorguru/.env`

## Nginx Sketch

```nginx
server {
    server_name theseniorguru.com www.theseniorguru.com;

    client_max_body_size 25m;

    location / {
        proxy_pass http://127.0.0.1:3051;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
    }
}
```

## Tomorrow Dependencies

- Confirm target droplet.
- Add production `.env`.
- Check `/api/v1/system/readiness` after env installation; it should report Supabase, email, ads, and hosting readiness without exposing secret values.
- Run Supabase migrations against production project.
- Build and start Docker service.
- Add nginx site and SSL.
- Confirm `thevaulted.com` files/config are untouched.
