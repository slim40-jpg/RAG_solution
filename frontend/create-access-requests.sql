CREATE TABLE IF NOT EXISTS access_requests (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    requester_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    document_id UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
    target_department_id UUID NOT NULL REFERENCES departments(id) ON DELETE CASCADE,
    status VARCHAR(50) DEFAULT 'pending',
    reason TEXT,
    reviewed_by UUID REFERENCES users(id) ON DELETE SET NULL,
    reviewed_at TIMESTAMP,
    access_token VARCHAR(255),
    expires_at TIMESTAMP,
    review_comment TEXT,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_access_requests_requester ON access_requests(requester_id);
CREATE INDEX idx_access_requests_document ON access_requests(document_id);
CREATE INDEX idx_access_requests_status ON access_requests(status);