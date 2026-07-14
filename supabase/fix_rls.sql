DROP POLICY IF EXISTS ii_messages_select ON public.improvement_messages;
CREATE POLICY ii_messages_select ON public.improvement_messages FOR SELECT
    USING (
        public.is_ii_staff() OR EXISTS (
            SELECT 1 FROM public.improvement_actions ac
            JOIN public.improvement_analyses a ON a.id = ac.analysis_id
            WHERE ac.id = improvement_messages.action_id AND a.player_id = public.current_player_id()
        )
    );
