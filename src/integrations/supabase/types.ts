export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.15"
  }
  public: {
    Tables: {
      audit_logs: {
        Row: {
          action: string
          actor_id: string | null
          actor_name: string | null
          created_at: string
          entity_id: string | null
          entity_type: string
          id: string
          new_value: Json | null
          old_value: Json | null
        }
        Insert: {
          action: string
          actor_id?: string | null
          actor_name?: string | null
          created_at?: string
          entity_id?: string | null
          entity_type: string
          id?: string
          new_value?: Json | null
          old_value?: Json | null
        }
        Update: {
          action?: string
          actor_id?: string | null
          actor_name?: string | null
          created_at?: string
          entity_id?: string | null
          entity_type?: string
          id?: string
          new_value?: Json | null
          old_value?: Json | null
        }
        Relationships: []
      }
      departments: {
        Row: {
          code: string
          created_at: string
          id: string
          name: string
        }
        Insert: {
          code: string
          created_at?: string
          id?: string
          name: string
        }
        Update: {
          code?: string
          created_at?: string
          id?: string
          name?: string
        }
        Relationships: []
      }
      drivers: {
        Row: {
          address: string | null
          allowed_categories: string[]
          alternate_phone: string | null
          base_location_id: string | null
          blood_group: string | null
          created_at: string
          current_status: string
          date_of_joining: string | null
          driver_code: string
          email: string | null
          emergency_contact: string | null
          experience_years: number
          full_name: string
          id: string
          license_expiry: string | null
          license_number: string
          license_type: string
          phone: string
          photo_url: string | null
          rating: number
          shift: string
          updated_at: string
          user_id: string | null
          weekly_off: number[]
        }
        Insert: {
          address?: string | null
          allowed_categories?: string[]
          alternate_phone?: string | null
          base_location_id?: string | null
          blood_group?: string | null
          created_at?: string
          current_status?: string
          date_of_joining?: string | null
          driver_code: string
          email?: string | null
          emergency_contact?: string | null
          experience_years?: number
          full_name: string
          id?: string
          license_expiry?: string | null
          license_number?: string
          license_type?: string
          phone?: string
          photo_url?: string | null
          rating?: number
          shift?: string
          updated_at?: string
          user_id?: string | null
          weekly_off?: number[]
        }
        Update: {
          address?: string | null
          allowed_categories?: string[]
          alternate_phone?: string | null
          base_location_id?: string | null
          blood_group?: string | null
          created_at?: string
          current_status?: string
          date_of_joining?: string | null
          driver_code?: string
          email?: string | null
          emergency_contact?: string | null
          experience_years?: number
          full_name?: string
          id?: string
          license_expiry?: string | null
          license_number?: string
          license_type?: string
          phone?: string
          photo_url?: string | null
          rating?: number
          shift?: string
          updated_at?: string
          user_id?: string | null
          weekly_off?: number[]
        }
        Relationships: [
          {
            foreignKeyName: "drivers_base_location_id_fkey"
            columns: ["base_location_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["id"]
          },
        ]
      }
      locations: {
        Row: {
          address: string
          created_at: string
          id: string
          is_active: boolean
          latitude: number | null
          location_type: string
          longitude: number | null
          name: string
        }
        Insert: {
          address?: string
          created_at?: string
          id?: string
          is_active?: boolean
          latitude?: number | null
          location_type?: string
          longitude?: number | null
          name: string
        }
        Update: {
          address?: string
          created_at?: string
          id?: string
          is_active?: boolean
          latitude?: number | null
          location_type?: string
          longitude?: number | null
          name?: string
        }
        Relationships: []
      }
      notifications: {
        Row: {
          audience_role: Database["public"]["Enums"]["app_role"] | null
          body: string
          category: string
          created_at: string
          id: string
          is_read: boolean
          link: string | null
          title: string
          user_id: string | null
        }
        Insert: {
          audience_role?: Database["public"]["Enums"]["app_role"] | null
          body?: string
          category?: string
          created_at?: string
          id?: string
          is_read?: boolean
          link?: string | null
          title: string
          user_id?: string | null
        }
        Update: {
          audience_role?: Database["public"]["Enums"]["app_role"] | null
          body?: string
          category?: string
          created_at?: string
          id?: string
          is_read?: boolean
          link?: string | null
          title?: string
          user_id?: string | null
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string
          department_id: string | null
          email: string | null
          employee_code: string | null
          full_name: string
          id: string
          phone: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          department_id?: string | null
          email?: string | null
          employee_code?: string | null
          full_name?: string
          id: string
          phone?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          department_id?: string | null
          email?: string | null
          employee_code?: string | null
          full_name?: string
          id?: string
          phone?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
        ]
      }
      request_passengers: {
        Row: {
          created_at: string
          department: string | null
          employee_code: string | null
          full_name: string
          id: string
          is_primary: boolean
          note: string | null
          passenger_type: string
          phone: string | null
          request_id: string
        }
        Insert: {
          created_at?: string
          department?: string | null
          employee_code?: string | null
          full_name: string
          id?: string
          is_primary?: boolean
          note?: string | null
          passenger_type?: string
          phone?: string | null
          request_id: string
        }
        Update: {
          created_at?: string
          department?: string | null
          employee_code?: string | null
          full_name?: string
          id?: string
          is_primary?: boolean
          note?: string | null
          passenger_type?: string
          phone?: string | null
          request_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "request_passengers_request_id_fkey"
            columns: ["request_id"]
            isOneToOne: false
            referencedRelation: "vehicle_requests"
            referencedColumns: ["id"]
          },
        ]
      }
      request_route_points: {
        Row: {
          address: string
          created_at: string
          expected_at: string | null
          id: string
          instruction: string | null
          latitude: number | null
          leg: string
          location_id: string | null
          longitude: number | null
          name: string
          point_type: string
          request_id: string
          sequence: number
        }
        Insert: {
          address?: string
          created_at?: string
          expected_at?: string | null
          id?: string
          instruction?: string | null
          latitude?: number | null
          leg?: string
          location_id?: string | null
          longitude?: number | null
          name: string
          point_type: string
          request_id: string
          sequence: number
        }
        Update: {
          address?: string
          created_at?: string
          expected_at?: string | null
          id?: string
          instruction?: string | null
          latitude?: number | null
          leg?: string
          location_id?: string | null
          longitude?: number | null
          name?: string
          point_type?: string
          request_id?: string
          sequence?: number
        }
        Relationships: [
          {
            foreignKeyName: "request_route_points_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "request_route_points_request_id_fkey"
            columns: ["request_id"]
            isOneToOne: false
            referencedRelation: "vehicle_requests"
            referencedColumns: ["id"]
          },
        ]
      }
      trip_status_history: {
        Row: {
          actor_id: string | null
          created_at: string
          from_status: string | null
          id: string
          latitude: number | null
          longitude: number | null
          note: string | null
          to_status: string
          trip_id: string
        }
        Insert: {
          actor_id?: string | null
          created_at?: string
          from_status?: string | null
          id?: string
          latitude?: number | null
          longitude?: number | null
          note?: string | null
          to_status: string
          trip_id: string
        }
        Update: {
          actor_id?: string | null
          created_at?: string
          from_status?: string | null
          id?: string
          latitude?: number | null
          longitude?: number | null
          note?: string | null
          to_status?: string
          trip_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "trip_status_history_trip_id_fkey"
            columns: ["trip_id"]
            isOneToOne: false
            referencedRelation: "trips"
            referencedColumns: ["id"]
          },
        ]
      }
      trips: {
        Row: {
          arrived_pickup_at: string | null
          completed_at: string | null
          created_at: string
          current_leg: string
          current_stop_index: number
          distance_km: number | null
          driver_id: string
          driver_notes: string | null
          fuel_cost: number | null
          id: string
          odometer_end: number | null
          odometer_start: number | null
          picked_up_at: string | null
          reference: string
          request_id: string
          started_at: string | null
          status: string
          updated_at: string
          vehicle_id: string
        }
        Insert: {
          arrived_pickup_at?: string | null
          completed_at?: string | null
          created_at?: string
          current_leg?: string
          current_stop_index?: number
          distance_km?: number | null
          driver_id: string
          driver_notes?: string | null
          fuel_cost?: number | null
          id?: string
          odometer_end?: number | null
          odometer_start?: number | null
          picked_up_at?: string | null
          reference?: string
          request_id: string
          started_at?: string | null
          status?: string
          updated_at?: string
          vehicle_id: string
        }
        Update: {
          arrived_pickup_at?: string | null
          completed_at?: string | null
          created_at?: string
          current_leg?: string
          current_stop_index?: number
          distance_km?: number | null
          driver_id?: string
          driver_notes?: string | null
          fuel_cost?: number | null
          id?: string
          odometer_end?: number | null
          odometer_start?: number | null
          picked_up_at?: string | null
          reference?: string
          request_id?: string
          started_at?: string | null
          status?: string
          updated_at?: string
          vehicle_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "trips_driver_id_fkey"
            columns: ["driver_id"]
            isOneToOne: false
            referencedRelation: "drivers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trips_request_id_fkey"
            columns: ["request_id"]
            isOneToOne: true
            referencedRelation: "vehicle_requests"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trips_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicles"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      vehicle_requests: {
        Row: {
          approved_at: string | null
          approved_by: string | null
          assigned_at: string | null
          assigned_by: string | null
          assigned_driver_id: string | null
          assigned_vehicle_id: string | null
          cost_center: string | null
          created_at: string
          department_id: string | null
          estimated_distance_km: number | null
          expected_end_at: string
          id: string
          is_round_trip: boolean
          journey_date: string
          passenger_count: number
          pickup_at: string
          priority: string
          purpose: string
          reference: string
          rejection_reason: string | null
          remarks: string | null
          requested_category: string | null
          requester_id: string | null
          requester_name: string
          requester_phone: string | null
          requires_ac: boolean
          return_expected_end_at: string | null
          return_pickup_at: string | null
          special_requirements: string | null
          status: string
          trip_type: string
          updated_at: string
          version: number
        }
        Insert: {
          approved_at?: string | null
          approved_by?: string | null
          assigned_at?: string | null
          assigned_by?: string | null
          assigned_driver_id?: string | null
          assigned_vehicle_id?: string | null
          cost_center?: string | null
          created_at?: string
          department_id?: string | null
          estimated_distance_km?: number | null
          expected_end_at: string
          id?: string
          is_round_trip?: boolean
          journey_date: string
          passenger_count: number
          pickup_at: string
          priority?: string
          purpose?: string
          reference?: string
          rejection_reason?: string | null
          remarks?: string | null
          requested_category?: string | null
          requester_id?: string | null
          requester_name: string
          requester_phone?: string | null
          requires_ac?: boolean
          return_expected_end_at?: string | null
          return_pickup_at?: string | null
          special_requirements?: string | null
          status?: string
          trip_type?: string
          updated_at?: string
          version?: number
        }
        Update: {
          approved_at?: string | null
          approved_by?: string | null
          assigned_at?: string | null
          assigned_by?: string | null
          assigned_driver_id?: string | null
          assigned_vehicle_id?: string | null
          cost_center?: string | null
          created_at?: string
          department_id?: string | null
          estimated_distance_km?: number | null
          expected_end_at?: string
          id?: string
          is_round_trip?: boolean
          journey_date?: string
          passenger_count?: number
          pickup_at?: string
          priority?: string
          purpose?: string
          reference?: string
          rejection_reason?: string | null
          remarks?: string | null
          requested_category?: string | null
          requester_id?: string | null
          requester_name?: string
          requester_phone?: string | null
          requires_ac?: boolean
          return_expected_end_at?: string | null
          return_pickup_at?: string | null
          special_requirements?: string | null
          status?: string
          trip_type?: string
          updated_at?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "vehicle_requests_assigned_driver_id_fkey"
            columns: ["assigned_driver_id"]
            isOneToOne: false
            referencedRelation: "drivers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vehicle_requests_assigned_vehicle_id_fkey"
            columns: ["assigned_vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vehicle_requests_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
        ]
      }
      vehicle_unavailability_requests: {
        Row: {
          admin_note: string | null
          created_at: string
          created_by: string | null
          description: string
          driver_id: string | null
          id: string
          latitude: number | null
          longitude: number | null
          photo_url: string | null
          reason: string
          reference: string
          reviewed_at: string | null
          reviewed_by: string | null
          severity: string
          status: string
          trip_id: string | null
          updated_at: string
          vehicle_id: string
        }
        Insert: {
          admin_note?: string | null
          created_at?: string
          created_by?: string | null
          description?: string
          driver_id?: string | null
          id?: string
          latitude?: number | null
          longitude?: number | null
          photo_url?: string | null
          reason: string
          reference?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          severity?: string
          status?: string
          trip_id?: string | null
          updated_at?: string
          vehicle_id: string
        }
        Update: {
          admin_note?: string | null
          created_at?: string
          created_by?: string | null
          description?: string
          driver_id?: string | null
          id?: string
          latitude?: number | null
          longitude?: number | null
          photo_url?: string | null
          reason?: string
          reference?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          severity?: string
          status?: string
          trip_id?: string | null
          updated_at?: string
          vehicle_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "vehicle_unavailability_requests_driver_id_fkey"
            columns: ["driver_id"]
            isOneToOne: false
            referencedRelation: "drivers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vehicle_unavailability_requests_trip_id_fkey"
            columns: ["trip_id"]
            isOneToOne: false
            referencedRelation: "trips"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vehicle_unavailability_requests_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicles"
            referencedColumns: ["id"]
          },
        ]
      }
      vehicles: {
        Row: {
          base_location_id: string | null
          branch: string
          brand: string
          category: string
          color: string | null
          created_at: string
          current_latitude: number | null
          current_longitude: number | null
          fitness_expiry: string | null
          fleet_number: string
          fuel_type: string
          has_ac: boolean
          id: string
          insurance_expiry: string | null
          is_vip: boolean
          last_service_date: string | null
          last_service_km: number
          luggage_capacity: number
          model: string
          model_year: number | null
          name: string
          notes: string | null
          odometer_km: number
          operational_status: string
          ownership: string
          photo_url: string | null
          registration_expiry: string | null
          registration_number: string
          seat_capacity: number
          service_interval_km: number
          tax_token_expiry: string | null
          transmission: string
          updated_at: string
        }
        Insert: {
          base_location_id?: string | null
          branch?: string
          brand?: string
          category: string
          color?: string | null
          created_at?: string
          current_latitude?: number | null
          current_longitude?: number | null
          fitness_expiry?: string | null
          fleet_number: string
          fuel_type?: string
          has_ac?: boolean
          id?: string
          insurance_expiry?: string | null
          is_vip?: boolean
          last_service_date?: string | null
          last_service_km?: number
          luggage_capacity?: number
          model?: string
          model_year?: number | null
          name: string
          notes?: string | null
          odometer_km?: number
          operational_status?: string
          ownership?: string
          photo_url?: string | null
          registration_expiry?: string | null
          registration_number: string
          seat_capacity: number
          service_interval_km?: number
          tax_token_expiry?: string | null
          transmission?: string
          updated_at?: string
        }
        Update: {
          base_location_id?: string | null
          branch?: string
          brand?: string
          category?: string
          color?: string | null
          created_at?: string
          current_latitude?: number | null
          current_longitude?: number | null
          fitness_expiry?: string | null
          fleet_number?: string
          fuel_type?: string
          has_ac?: boolean
          id?: string
          insurance_expiry?: string | null
          is_vip?: boolean
          last_service_date?: string | null
          last_service_km?: number
          luggage_capacity?: number
          model?: string
          model_year?: number | null
          name?: string
          notes?: string | null
          odometer_km?: number
          operational_status?: string
          ownership?: string
          photo_url?: string | null
          registration_expiry?: string | null
          registration_number?: string
          seat_capacity?: number
          service_interval_km?: number
          tax_token_expiry?: string | null
          transmission?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "vehicles_base_location_id_fkey"
            columns: ["base_location_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      advance_trip: {
        Args: {
          _action: string
          _actor?: string
          _payload?: Json
          _trip_id: string
        }
        Returns: Json
      }
      assign_request: {
        Args: {
          _actor?: string
          _driver_id: string
          _request_id: string
          _vehicle_id: string
        }
        Returns: Json
      }
      earth: { Args: never; Returns: number }
      get_recommendations: { Args: { _request_id: string }; Returns: Json }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_dispatcher: { Args: { _user_id: string }; Returns: boolean }
      next_ref: { Args: { _prefix: string; _seq: string }; Returns: string }
      request_window: {
        Args: { _buffer_min?: number; _end: string; _pickup: string }
        Returns: unknown
      }
    }
    Enums: {
      app_role:
        | "employee"
        | "transport_admin"
        | "fleet_manager"
        | "driver"
        | "system_admin"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: [
        "employee",
        "transport_admin",
        "fleet_manager",
        "driver",
        "system_admin",
      ],
    },
  },
} as const
