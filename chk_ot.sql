CREATE TABLE IF NOT EXISTS overtime_requests (
  id INT AUTO_INCREMENT PRIMARY KEY,
  member_name VARCHAR(255) NOT NULL,
  request_date DATE NOT NULL,
  start_time VARCHAR(10),
  end_time VARCHAR(10),
  hours DECIMAL(4,2) NOT NULL,
  reason TEXT,
  revision_count INT DEFAULT 0,
  status ENUM('Pending','IT_Approved','Approved','Declined') DEFAULT 'Pending',
  it_supervisor_approved_by VARCHAR(255) DEFAULT '',
  it_supervisor_approved_at DATETIME,
  manager_approved_by VARCHAR(255) DEFAULT '',
  manager_approved_at DATETIME,
  declined_by VARCHAR(255) DEFAULT '',
  decline_reason TEXT,
  created_at DATETIME DEFAULT NOW(),
  updated_at DATETIME DEFAULT NOW() ON UPDATE NOW()
);
