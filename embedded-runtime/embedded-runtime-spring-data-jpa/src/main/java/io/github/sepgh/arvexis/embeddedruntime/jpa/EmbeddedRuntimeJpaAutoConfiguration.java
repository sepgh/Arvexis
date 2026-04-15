package io.github.sepgh.arvexis.embeddedruntime.jpa;

import io.github.sepgh.arvexis.embeddedruntime.core.RuntimeSpis.GameSessionRepository;
import org.springframework.boot.autoconfigure.AutoConfiguration;
import org.springframework.boot.autoconfigure.jdbc.DataSourceAutoConfiguration;
import org.springframework.boot.autoconfigure.orm.jpa.HibernateJpaAutoConfiguration;
import org.springframework.boot.autoconfigure.condition.ConditionalOnBean;
import org.springframework.boot.autoconfigure.condition.ConditionalOnClass;
import org.springframework.boot.autoconfigure.condition.ConditionalOnMissingBean;
import org.springframework.boot.autoconfigure.domain.EntityScan;
import org.springframework.context.annotation.Bean;
import org.springframework.data.jpa.repository.config.EnableJpaRepositories;

import javax.sql.DataSource;

@AutoConfiguration(after = {DataSourceAutoConfiguration.class, HibernateJpaAutoConfiguration.class})
@ConditionalOnClass(JpaGameSessionSpringRepository.class)
@ConditionalOnBean(DataSource.class)
@EntityScan(basePackageClasses = JpaGameSessionEntity.class)
@EnableJpaRepositories(basePackageClasses = JpaGameSessionSpringRepository.class)
public class EmbeddedRuntimeJpaAutoConfiguration {
    @Bean
    @ConditionalOnMissingBean(GameSessionRepository.class)
    public GameSessionRepository embeddedRuntimeGameSessionRepository(JpaGameSessionSpringRepository repository) {
        return new JpaGameSessionRepositoryAdapter(repository);
    }
}
