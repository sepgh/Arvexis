package io.github.sepgh.arvexis.embeddedruntime.jpa;

import io.github.sepgh.arvexis.embeddedruntime.core.RuntimeSpis.GameSessionRepository;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.SpringBootConfiguration;
import org.springframework.boot.autoconfigure.EnableAutoConfiguration;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.ApplicationContext;

import static org.assertj.core.api.Assertions.assertThat;

@SpringBootTest(
    classes = EmbeddedRuntimeJpaAutoConfigurationTest.AutoConfiguredJpaApplication.class,
    properties = {
        "spring.datasource.url=jdbc:h2:mem:embedded-runtime-jpa-auto;DB_CLOSE_DELAY=-1;MODE=PostgreSQL",
        "spring.datasource.driverClassName=org.h2.Driver",
        "spring.datasource.username=sa",
        "spring.datasource.password=",
        "spring.jpa.hibernate.ddl-auto=create-drop"
    }
)
class EmbeddedRuntimeJpaAutoConfigurationTest {
    @Autowired
    private ApplicationContext applicationContext;

    @Autowired
    private GameSessionRepository gameSessionRepository;

    @Test
    void registersJpaBackedGameSessionRepositoryWhenDataSourceExists() {
        assertThat(applicationContext.getBeansOfType(GameSessionRepository.class)).hasSize(1);
        assertThat(gameSessionRepository).isInstanceOf(JpaGameSessionRepositoryAdapter.class);
        assertThat(applicationContext.getBeansOfType(JpaGameSessionSpringRepository.class)).hasSize(1);
    }

    @SpringBootConfiguration
    @EnableAutoConfiguration
    static class AutoConfiguredJpaApplication {
    }
}
