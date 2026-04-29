export const FRAMEWORKS = {
  knex:       { label: 'Knex',       migrate: 'npm run migrations', seed: 'npm run seeds' },
  prisma:     { label: 'Prisma',     migrate: 'npx prisma migrate deploy', seed: 'npx prisma db seed' },
  flyway:     { label: 'Flyway',     migrate: 'flyway migrate', seed: '' },
  liquibase:  { label: 'Liquibase',  migrate: 'liquibase update', seed: '' },
  django:     { label: 'Django',     migrate: 'python3 manage.py migrate', seed: 'python3 manage.py loaddata fixtures/' },
  alembic:    { label: 'Alembic',    migrate: 'alembic upgrade head', seed: '' },
  laravel:    { label: 'Laravel',    migrate: 'php artisan migrate', seed: 'php artisan db:seed' },
  custom:     { label: 'Custom',     migrate: '', seed: '' },
};

export const FRAMEWORK_CHOICES = Object.entries(FRAMEWORKS).map(([value, { label }]) => ({
  name: label,
  value,
}));
