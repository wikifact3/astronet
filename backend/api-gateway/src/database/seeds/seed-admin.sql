-- Give the seeded admin staff user a default password.
-- Password: ChangeMe123!
-- Hash: bcrypt with 10 rounds. Regenerate when you want a different one.
UPDATE powerlink_core.staff_users
SET
  password_hash = '$2b$10$kDHWwlqhD9y0FDAHQqURReIkKcO4T34YvxKQu0K6FQ8m3PFi2y79K',
  last_password_change_at = NOW()
WHERE email = 'admin@powerlink.com.np'
  AND password_hash IS NULL;
