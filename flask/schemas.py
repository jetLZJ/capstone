from marshmallow import Schema, fields, validate


class ShiftSchema(Schema):
    name = fields.String(required=True, validate=validate.Length(min=1))
    role_required = fields.String(required=False, allow_none=True)
    start_time = fields.String(required=False, allow_none=True)
    end_time = fields.String(required=False, allow_none=True)


class AssignmentSchema(Schema):
    shift_id = fields.Int(required=True)
    assigned_user = fields.Int(required=True)
    shift_date = fields.Date(required=True)
    role = fields.String(required=False, allow_none=True)
