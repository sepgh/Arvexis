package com.engine.embeddedruntime.jpa;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface JpaGameSessionSpringRepository extends JpaRepository<JpaGameSessionEntity, String> {
    Optional<JpaGameSessionEntity> findFirstByPlayerIdAndGameKeyOrderByUpdatedAtDesc(String playerId, String gameKey);

    boolean existsByPlayerIdAndGameKey(String playerId, String gameKey);
}
