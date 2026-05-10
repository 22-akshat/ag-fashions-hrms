-- Remove deprecated columns
ALTER TABLE public.employees DROP COLUMN IF EXISTS timepolicy_is_single_punch;
ALTER TABLE public.employees DROP COLUMN IF EXISTS weekly_off_calculation;
ALTER TABLE public.employees DROP COLUMN IF EXISTS timepolicy_policy_name;

-- Rename legacy Base44-style columns to cleaner names
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'employees' AND column_name = 'unit_branch_name'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'employees' AND column_name = 'job_location'
  ) THEN
    ALTER TABLE public.employees RENAME COLUMN unit_branch_name TO job_location;
  END IF;
END
$$;

ALTER TABLE public.employees ADD COLUMN IF NOT EXISTS job_location text NOT NULL DEFAULT '';
ALTER TABLE public.employees ADD COLUMN IF NOT EXISTS department text NOT NULL DEFAULT '';
ALTER TABLE public.employees ADD COLUMN IF NOT EXISTS designation text NOT NULL DEFAULT '';

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'employees' AND column_name = 'department_department'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'employees' AND column_name = 'department'
  ) THEN
    ALTER TABLE public.employees RENAME COLUMN department_department TO department;
  END IF;
END
$$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'employees' AND column_name = 'designation_design_code'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'employees' AND column_name = 'designation'
  ) THEN
    ALTER TABLE public.employees RENAME COLUMN designation_design_code TO designation;
  END IF;
END
$$;

-- Add new columns
ALTER TABLE public.employees ADD COLUMN IF NOT EXISTS father_husband_name text NOT NULL DEFAULT '';
ALTER TABLE public.employees ADD COLUMN IF NOT EXISTS marital_status text NOT NULL DEFAULT 'Single';
ALTER TABLE public.employees ADD COLUMN IF NOT EXISTS salary numeric(12,2) DEFAULT 0;
ALTER TABLE public.employees ADD COLUMN IF NOT EXISTS esic_no text NOT NULL DEFAULT '';
ALTER TABLE public.employees ADD COLUMN IF NOT EXISTS uan_no text NOT NULL DEFAULT '';
ALTER TABLE public.employees ADD COLUMN IF NOT EXISTS local_address text NOT NULL DEFAULT '';
ALTER TABLE public.employees ADD COLUMN IF NOT EXISTS permanent_address text NOT NULL DEFAULT '';

-- Add CHECK constraint for marital_status
ALTER TABLE public.employees DROP CONSTRAINT IF EXISTS employees_marital_status_chk;
ALTER TABLE public.employees
ADD CONSTRAINT employees_marital_status_chk
CHECK (marital_status IN ('Single', 'Married', 'Divorced', 'Widowed'));

-- Update status check for current app semantics
ALTER TABLE public.employees DROP CONSTRAINT IF EXISTS employees_status_chk;
ALTER TABLE public.employees
ADD CONSTRAINT employees_status_chk
CHECK (status IN ('Active', 'Inactive'));

-- Update the department index to use the new column name
DROP INDEX IF EXISTS employees_department_idx;
CREATE INDEX IF NOT EXISTS employees_department_idx ON public.employees (department);
