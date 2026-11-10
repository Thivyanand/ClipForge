# Infrastructure

Local development infrastructure is defined in the repository-root `docker-compose.yml`.

Production direction (not provisioned yet):

- Container workloads: AWS ECS
- Container registry: AWS ECR
- Relational database: Amazon RDS for PostgreSQL
- Object storage: Amazon S3
- Durable job delivery: Amazon SQS
- CDN: Amazon CloudFront
- Secrets: AWS Secrets Manager
- Monitoring: Amazon CloudWatch

Infrastructure will be provisioned only after workload and cost assumptions are validated. Never commit cloud credentials or Terraform state.
