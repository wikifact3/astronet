-- Dev seed: one customer, one account, one active subscription
DO $$
DECLARE
  v_customer_id UUID;
  v_account_id UUID;
  v_plan_id UUID;
  v_subscription_id UUID;
BEGIN
  -- Reuse admin customer if present, else create one
  SELECT id INTO v_customer_id
  FROM powerlink_core.customers
  WHERE phone = '9801234567';

  IF v_customer_id IS NULL THEN
    INSERT INTO powerlink_core.customers (phone, email, full_name, preferred_language, kyc_status)
    VALUES ('9801234567', 'dev@powerlink.local', 'Dev Customer', 'en', 'approved')
    RETURNING id INTO v_customer_id;
  END IF;

  -- Plan: Fiber Standard
  SELECT id INTO v_plan_id FROM powerlink_core.plans WHERE name = 'Fiber Standard' LIMIT 1;
  IF v_plan_id IS NULL THEN
    RAISE EXCEPTION 'Fiber Standard plan not found';
  END IF;

  -- Account (if not already present)
  SELECT id INTO v_account_id
  FROM powerlink_core.accounts
  WHERE customer_id = v_customer_id
  LIMIT 1;

  IF v_account_id IS NULL THEN
    INSERT INTO powerlink_core.accounts
      (customer_id, account_type, status, referral_code)
    VALUES
      (v_customer_id, 'retail', 'active', 'DEVREF01')
    RETURNING id INTO v_account_id;
  END IF;

  -- Subscription (if not already present)
  SELECT id INTO v_subscription_id
  FROM powerlink_core.subscriptions
  WHERE account_id = v_account_id
  LIMIT 1;

  IF v_subscription_id IS NULL THEN
    INSERT INTO powerlink_core.subscriptions
      (account_id, plan_id, status, validity_start, validity_end, fup_tier, auto_renew)
    VALUES
      (v_account_id, v_plan_id, 'active', CURRENT_DATE, CURRENT_DATE + INTERVAL '25 days', 'normal', true);
  END IF;
END $$;
